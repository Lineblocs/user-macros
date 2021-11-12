var PROTO_PATH = __dirname + '/router.proto';
var grpc = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');
const vm = require('vm');
const util = require('util');
const uuid = require("uuid");
var request = require("request-promise");
const sdk = require('lineblocs-sdk');
const Channel = require('lineblocs-sdk/models/channel');
const Cell = require('lineblocs-sdk/models/cell');
const Flow = require('lineblocs-sdk/models/flow');

var BASE_URL='https://internals.lineblocs.com'

// Suggested options for similarity to existing grpc.load behavior
var packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {keepCase: true,
     longs: String,
     enums: String,
     defaults: true,
     oneofs: true
    });
var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
var router = protoDescriptor.router

var includeHeaders = function (body, response, resolveWithFullResponse) {
	return {
		'headers': response.headers,
		'data': body
	};
};

function vmLog(tag) {
  var args = arguments;

  if ( args.length === 2 ) {
	var loggable= JSON.stringify( args[ 1 ] );
    console.log("User VM script " + tag + ": " + loggable);
  }
  if ( args.length === 3 ) {
	var loggable1 = JSON.stringify( args[ 1 ] );
	var loggable2 = JSON.stringify( args[ 2 ] );
    console.log("User VM script " + tag + ": " +  loggable1 + " " + loggable2);
  }
}
function createSDKUsingEnvironment() {
    var clientId = uuid.v4();
    var token = process.env['LINEBLOCS_TOKEN']||'';
    var secret = process.env['LINEBLOCS_SECRET']||'';
    var workspace  = process.env['LINEBLOCS_WORKSPACE_ID']||'1';
    var user  = process.env['LINEBLOCS_USER_ID']||'1';
    var domain = process.env['LINEBLOCS_DOMAIN']||'workspace.lineblocs.com';
    var connectArgs = {
        token: token,
        secret: secret,
        clientid: clientId,
        workspaceid: workspace,
        userid: user,
        domain: domain
    }
    return sdk( connectArgs );
}
function buildContext(params) {
    console.log("params ", params)
    var channelId = params['channel_id']
    var flowId = params['channel_id']
    var cellId = params['cell_id']
    var cellName = params['cell_name']
    var sdk = createSDKUsingEnvironment();
    var channel = new Channel( sdk, channelId );
    var flow = new Flow( sdk, flowId );
    var cell = new Cell( sdk, cellId, cellName );
    return {
        channel,
        lineChannel: channel,
        flow,
        lineFlow: flow,
        cell,
        lineCell: cell,
        getSDK: function() {
            return sdk;
        }
    };
}
function createVMContext(params) {
    const vmConsole = {
        log: function(...args) {
            vmLog("console.log", ...args);
        },
        error: function(...args) {
            vmLog("console.error", ...args);
        },
        warning: function(...args) {
            vmLog("console.warning", ...args);
        },
    };

    var ctx = {console: vmConsole, context: buildContext(params)};
    var context =  vm.createContext({
        ...ctx,
        __filename: "",
        __dirname: "",
        exports: exports,
        require: require,
        module: module,
        setTimeout: setTimeout
    });
        

    return context;
}

async function safeAPICall(opts) {
	return new Promise( async function(resolve, reject) {
		try {
			var result = await request(opts);
			resolve( result );
		} catch (err) {
			reject("API error: " + err);
			//reject("API error");
			return;
		}
	});
}

async function getWorkspaceMacros(workspace) {
	var params = {};
	var url = BASE_URL + '/user/getWorkspaceMacros?workspace='+workspace;
	//params['workpace'] =workspace;
	var options = {
		uri: url,
		qs: params,
		headers: {},
		json: true // Automatically parses the JSON string in the response
	};
	return safeAPICall(options);
}



async function main() {
  console.log("starting server..")
  var workspace  = process.env['LINEBLOCS_WORKSPACE_ID']||'27';
  var macros = await getWorkspaceMacros(workspace)
  console.log("got macros ", macros)
  var server = new grpc.Server();

  function callMacro(call, callback) {
    var request = call.request;
    var name = request.name;
    // get handler for this function
    var foundObj;
    for ( var index in macros ) {
        var functionObj = macros[ index ];
        if ( functionObj.title === name ) {
            foundObj = functionObj;
        }
    }
    if ( !foundObj ) {
        callback(null, {error: true, msg: 'could not find handler'})
        return
    }
    //var code = "var x = 1; console.log('111');";
    const script = new vm.Script(foundObj.compiled_code);
    //var event = JSON.parse( process.env['PARAMS'] || '{}');
    var event = request.event;
    var context =buildContext(event);
    console.log("received event..", event);
    console.log("running macro: " + name)

var vmContext = createVMContext(event);
    script.runInContext(vmContext)( event, context ).then(function(result) {
        callback(null, {error: false, result:result})
    })
  }

  server.addService(router.LineblocsWorspaceSvc.service, {callMacro: callMacro})
  console.log("added svc")
  server.bindAsync('0.0.0.0:10000', grpc.ServerCredentials.createInsecure(), () => {
    console.log('running server..')
    server.start();
  });
  return Promise.resolve()
}

setImmediate(async () => {
    await main();
})
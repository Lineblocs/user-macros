const vm = require('vm');
const util = require('util');
const uuid = require("uuid");
const sdk = require('lineblocs-sdk');
const Channel = require('lineblocs-sdk/models/channel');

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

function buildContext() {
    var channelId = process.env['CHANNEL_ID']||'';
    var channel = new Channel( channelId );
    return {
        channel: channel,
        getSDK: function() {
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
    };
}
function createVMContext() {
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

    var ctx = {console: vmConsole, context: buildContext()};
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

console.log("creating VM context...");
var vmContext = createVMContext();
console.log("running code");
setImmediate(async () => {
    let b64 = process.env['SCRIPT_B64']||'';
    let buff = Buffer.from(b64, 'base64');
    //let code = buff.toString('ascii');
    let code = `module.exports = async function(event, context) {
        console.log( event );
        var sdk = context.getSDK();
        /*
        var bridge = await sdk.createBridge();
        console.log("BRIDGE ID = " + bridge.bridge_id);
        bridge.on('BridgeCreated', async function(bridge) {
            console.log("bridge created..");
        });
        */
        var conf = await sdk.createConference("Test");
    }`;

    console.log(code);
    //var code = "var x = 1; console.log('111');";
    const script = new vm.Script(code);
    var event = JSON.parse( process.env['PARAMS'] || '{}');
    var context =buildContext();
    var promise = script.runInContext(vmContext)( event, context );
    await promise;
});
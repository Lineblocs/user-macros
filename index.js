const vm = require('vm');
const util = require('util');

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

    var ctx = {console: vmConsole};
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
    let data = 'c3RhY2thYnVzZS5jb20=';
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    var code = "var x = 1; console.log('111');";
    const script = new vm.Script(code);
    script.runInContext(vmContext);
});
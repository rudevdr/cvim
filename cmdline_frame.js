window.isCommandFrame = true;

// if callback is function, inside callback use `this` to use args passed as second method in Command.onreload
// e.g
// function test(){
// 		console.log('value', this.a) //if a is not defined then will throw error, but we are using this.a
// }
// a = 10
// Command.onreload(test, {a})
chrome.runtime.onMessage.addListener(function onMessage(request, sender, sendResponse) {
    if (request.type == "onReload") {
        chrome.extension.onMessage.removeListener(onMessage)
        sendResponse({
            received: true
        })
        ctype = request.ctype
        args = '__args = ' + JSON.stringify(request.args) + ';\n' + 'if(__args){Object.keys(__args).forEach(key => {window[key] = __args[key]});}\n'
        switch (ctype) {
            case "function":
                code = args + '(' + request.callback + ')();'
                break;
            case "string":
                code = args + request.callback
                break;
        }
        chrome.tabs.executeScript({
            code: code
        })
    }
});

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
        switch (ctype) {
            case "function":
                callback = new Function('return ' + request.callback)()
                callback.call(request.args)
                break;
            case "string":
                eval(request.callback)
                break;
        }
    }
});

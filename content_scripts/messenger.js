var port = chrome.extension.connect({
    name: 'main'
});
port.onDisconnect.addListener(function() {
    window.portDestroyed = true;
    chrome.runtime.sendMessage = function() {};
    chrome.runtime.connect = function() {};
    Command.hide();
    removeListeners();
    Visual.exit();
    Find.clear();
    Command.destroy();
});

(function() {
    var $ = function(FN, caller) {
        return function(action, args, callback) {
            if (typeof args === 'function') {
                callback = args;
                args = {};
            }
            (args = args || {}).action = action;
            FN.call(caller, args, typeof callback === 'function' ?
                callback : void 0);
        };
    };
    RUNTIME = $(chrome.runtime.sendMessage, chrome.runtime);
    PORT = $(port.postMessage, port);
    ECHO = function(action, args, callback) {
        args.action = 'echoRequest';
        args.call = action;
        port.postMessage(args, typeof calback === 'function' ?
            callback : void 0);
    };
})();

port.onMessage.addListener(function(response) {
    var key;
    switch (response.type) {
        case 'hello':
            PORT('getSettings');
            PORT('getBookmarks');
            PORT('getQuickMarks');
            PORT('getSessionNames');
            PORT('retrieveAllHistory');
            PORT('sendLastSearch');
            PORT('getTopSites');
            PORT('getLastCommand');
            break;
        case 'addFrame':
            if (innerWidth > 5 && innerHeight > 5)
                Frames.init(response.frameId);
            break;
        case 'focusFrame':
            Frames.focus(response.disableAnimation);
            break;
        case 'updateLastCommand':
            Mappings.lastCommand = JSON.parse(response.data);
            break;
        case 'commandHistory':
            for (key in response.history) {
                Command.history[key] = response.history[key];
            }
            break;
        case 'history':
            var matches = [];
            for (key in response.history) {
                if (response.history[key].url) {
                    if (response.history[key].title.trim() === '') {
                        matches.push(['Untitled', response.history[key].url]);
                    } else {
                        matches.push([response.history[key].title, response.history[key].url]);
                    }
                }
            }
            if (Command.historyMode) {
                if (Command.active && Command.bar.style.display !== 'none') {
                    Command.completions = {
                        history: matches
                    };
                    Command.updateCompletions(false);
                }
            } else if (Command.searchMode) {
                Command.searchMode = false;
                if (Command.active && Command.bar.style.display !== 'none') {
                    Command.completions.history = matches;
                    Command.updateCompletions(true);
                }
            }
            break;
        case 'bookmarks':
            Marks.parse(response.bookmarks);
            break;
        case 'topsites':
            Search.topSites = response.sites;
            break;
        case 'buffers':
            if (Command.bar.style.display !== 'none') {
                var val = Command.input.value.replace(/\S+\s+/, '');
                Command.hideData();
                Command.completions = {
                    buffers: (function() {
                        if (!val.trim() ||
                            Number.isNaN(val) ||
                            !response.buffers[+val - 1])
                            return searchArray({
                                array: response.buffers,
                                search: val,
                                limit: settings.searchlimit,
                                fn: function(item) {
                                    return item.join(' ');
                                }
                            });
                        return [response.buffers[+val - 1]] || [];
                    })()
                };
                Command.updateCompletions();
            }
            break;
        case 'sessions':
            sessions = response.sessions;
            break;
        case 'quickMarks':
            Marks.parseQuickMarks(response.marks);
            break;
        case 'bookmarkPath':
            if (response.path.length) {
                Command.completions = {};
                Command.completions.paths = response.path;
                Command.updateCompletions();
            } else {
                Command.hideData();
            }
            break;
        case 'editWithVim':
            var lastInputElement = Mappings.insertFunctions.__getElement__();
            if (lastInputElement) {
                lastInputElement[lastInputElement.value !== void 0 ? 'value' : 'innerHTML'] =
                    response.text.replace(/\n$/, ''); // remove trailing line left by vim
                if (!DOM.isSubmittable(lastInputElement)) {
                    lastInputElement.blur();
                }
            }
            break;
        case 'httpRequest':
            httpCallback(response.id, response.text);
            break;
        case 'parseRC':
            if (response.config.MAPPINGS) {
                Utils.split(response.config.MAPPINGS, '\n').forEach(Mappings.parseLine);
                delete response.config.MAPPINGS;
            }
            Command.updateSettings(response.config);
            break;
        case 'sendSettings':
            Mappings.defaults = Object.clone(Mappings.defaultsClone);
            KeyHandler.listener.setLangMap(response.settings.langmap || '');
            if (!Command.initialLoadStarted) {
                Command.configureSettings(response.settings);
            } else {
                settings = response.settings;
                Mappings.parseCustom(settings.MAPPINGS, true);
            }
            break;
        case 'updateLastCommand':
            if (request.data) {
                Mappings.lastCommand = JSON.parse(request.data);
            }
            break;
    }
});

chrome.extension.onMessage.addListener(function(request, sender, callback) {
    switch (request.action) {
        case 'hideHud':
            HUD.hide(true);
            break;
        case 'commandHistory':
            for (var key in request.history) {
                Command.history[key] = request.history[key];
            }
            break;
        case 'updateLastSearch':
            Find.lastSearch = request.value;
            break;
        case 'sendSettings':
            Mappings.defaults = Object.clone(Mappings.defaultsClone);
            if (!Command.initialLoadStarted) {
                Command.configureSettings(request.settings);
            } else {
                settings = request.settings;
                Mappings.parseCustom(settings.MAPPINGS, true);
            }
            break;
        case 'cancelAllWebRequests':
            window.stop();
            break;
        case 'updateMarks':
            Marks.parseQuickMarks(request.marks);
            break;
        case 'nextCompletionResult':
            if (window.isCommandFrame) {
                if (settings.cncpcompletion &&
                    Command.commandBarFocused() &&
                    Command.type === 'action') {
                    Search.nextResult();
                    break;
                }
                callback(true);
            }
            break;
        case 'deleteBackWord':
            if (!insertMode && DOM.isEditable(document.activeElement)) {
                Mappings.insertFunctions.deleteWord();
                if (Command.commandBarFocused() && Command.type === 'action')
                    Command.complete(Command.input.value);
            }
            break;
        case 'toggleEnabled':
            addListeners();
            if (!settings) {
                RUNTIME('getSettings');
            }
            Command.init(!Command.loaded);
            break;
        case 'getBlacklistStatus':
            callback(Command.blacklisted);
            break;
        case 'alert':
            alert(request.message);
            break;
        case 'showCommandFrame':
            if (Command.frame) {
                Command.frame.style.display = 'block';
                Command.frame.contentWindow.focus();
            }
            if (window.isCommandFrame === true) {
                window.focus();
                Command.show(request.search, request.value, request.complete);
            }
            break;
        case 'hideCommandFrame':
            window.wasFocused = false;
            if (Command.frame) {
                Command.frame.style.display = 'none';
                callback();
            }
            break;
        case 'callFind':
            if (window.wasFocused) {
                Find[request.command].apply(Find, request.params);
            }
            break;
        case 'setFindIndex':
            if (window.wasFocused) {
                Find.index = request.index;
            }
            break;
        case 'doIncSearch':
            if (!window.wasFocused)
                break;
            Find.clear();
            Find.highlight({
                base: document.body,
                mode: request.mode,
                search: request.search
            });
            Find.setIndex();
            Find.search(request.mode, request.mode === '?' ? 1 : 0, true);
            break;
        case 'cancelIncSearch':
            if (Command.lastScrollTop !== void 0)
                document.scrollingElement.scrollTop = Command.lastScrollTop;
            if (Find.previousMatches &&
                request.search &&
                Find.lastSearch &&
                Find.lastSearch !== request.search) {
                Find.clear();
                HUD.hide();
                Find.highlight({
                    base: document.body,
                    search: Find.lastSearch,
                    setIndex: false,
                    executeSearch: false,
                    reverse: true,
                    saveSearch: true
                });
                Find.index = Find.lastIndex - 1;
                Find.search('/', 1, false);
            } else {
                Find.clear();
                HUD.hide();
            }
            break;
        case 'echoRequest':
            if (!window.isCommandFrame) {
                switch (request.call) {
                    case 'callMapFunction':
                        Mappings.actions[request.name](1);
                        break;
                    case 'eval':
                        eval(settings.FUNCTIONS[request.name] + request.args);
                        break;
                }
            }
            break;
        case 'displayTabIndices':
            if (Session.isRootFrame) {
                Command.onSettingsLoad(function() {
                    if (settings.showtabindices) {
                        Session.ignoreTitleUpdate = true;
                        if (document.title === '' + request.index) {
                            if (location.hostname + location.pathname ===
                                'www.google.com/_/chrome/newtab') {
                                document.title = Session.tabIndex + ' New Tab';
                            } else {
                                document.title = Session.tabIndex + ' ' +
                                    location.href.replace(/.*\//, '');
                            }
                        } else {
                            document.title = document.title.replace(
                                new RegExp('^(' + Session.tabIndex + ' )?'),
                                (request.index ? request.index + ' ' : ''));
                        }
                    }
                    Session.tabIndex = request.index;
                });
            }
            break;
        case 'isFrameVisible':
            callback(e.innerWidth > 5 && e.innerHeight > 5);
            break;
        case 'focusTabOverlay':
            window.onbeforeunload = function(e) {
                return 'blocked accidental?';
            }
            let overlay = document.createElement('div');

            overlay.style.cssText = "position: fixed; display: block; width: 100%; height: 100%; top: 0; left: 0; right: 0; bottom: 0; background-color: rgb(233, 30, 99, 0.3); z-index: 1000; cursor: pointer; text-align: center; vertical-align: middle; font-size: 50px";
            overlay.id = "cvim_focustab_overlay"

            overlay.onclick = function(e) {
                e.stopPropagation();
                overlay.remove();
            }

            blocked = 0;
            overlay.onkeypress = function(e) {
                overlay.innerText = 'BLOCKED ' + ++blocked + ' ACCIDENTAL INPUT ON AUTOFOCUS';
            }

            document.body.appendChild(overlay)

            setTimeout(function() {
                overlay.remove()
            }, 1000)

            setTimeout(function() {
                window.onbeforeunload = function(e) {};
            }, 2500)
            break;
        case 'onReload':
            /**
			 if callback is function, inside callback use `this` to use args passed as second method in Command.onreload e.g
             function test(){
				console.log('value', this.a) //if a is not defined then will throw error, but we are using this.a
             }
             a = 10
			 Command.onreload(test, {a})
			 **/
            if (request.type == "onReload") {
                callback({
                    received: true
                })
                args = '__args = ' + JSON.stringify(request.args) + ';\n' + 'if(__args){Object.keys(__args).forEach(key => {window[key] = __args[key]});}\n'
                switch (request.ctype) {
                    case "function":
                        code = args + '(' + request.callback + ')();'
                        break;
                    case "string":
                        code = args + request.callback
                        break;
                }
                eval(code)
            }
            break;
    }
});

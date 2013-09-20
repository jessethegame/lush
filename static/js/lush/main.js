// Copyright © 2013 Hraban Luyat <hraban@0brg.net>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.

"use strict";

// Scripting for root page
//
// sorry for the mess
//
// general idea:
//
// COMMAND OBJECTS
//
// TODO: This is obsolete. check out Command.js
// commands are represented in the global array "cmds" as objects (usually
// called "cmd" when assigned to a variable). there is no spec on the
// properties in a cmd object (frowny face) but you can get the idea from a
// couple places:
//
// metacmd.go defines serialization of the cmd object from the server side.
// this is where a cmd object comes to life as a JSON object
//
// that json thing finds its way to the createCmdWidget function. there a
// widget is created and initialized for the command and some extra stuff is
// added to the cmd object like functions and more properties.
//
// sounds good to me what could possibly go wrong?
//
// WIDGETS
//
// thats what I call those draggable boxes that represent a command in the UI
//
// CONTROL STREAM
//
// this script opens a websocket connection to /ctrl where the client and
// server talk to eachother about food and fashion and larry king. shockingly,
// there is no spec for this, either. check out websocket.go for the messages
// that the server can handle. check out every line of every .js file to see
// what messages the client can handle. or grep $(ctrl).on in this file thats
// probably easier. see ctrl.js for details. in code. haha what you thought in
// documentation?
//
// Note that websocket messages are broadcasted to every connected client.
// There is no request/reply system even though it does look like that its
// slightly different. This is mostly relevant when you have multiple connected
// clients.
//
// Eg when you want to get the path. You say "getpath", but the server doesnt
// really reply with the path. okay it kinda does but this is about the idea
// bear (haha) (thats the lamest joke since the invention of paper) with me
// here.
//
// what it does is send (wow i still cant believe i made that bear joke) "This
// is the path: " message to all clients. the server can do that whenever
// it wants, for whatever reason. it HAPPENS to only do it when a client
// requests it or when the path changes, but the client doesnt treat it that
// way. what it does is whenever the "path" websocket message comes in (look
// for $(ctrl).on("path", ...)) it updates the entire UI with this new path.
// THEN it says "hey server send me the path" ("getpah"), knowing that when it
// does, the handling of the response is in place.
//
// so basically instead of this (in order of execution):
//
// 1 ask question
// 2 get answer
// 3 handle answer
//
// the code does this:
//
// 1 handle answer (ctrl.handleEvent(...))
// 2 ask question (ctrl.send())
// 3 get answer
//
// that bear joke wasn't even a double meaning i just misspelled something and
// it happened to be another word. oh my god. hilarity.
//
// the path example is simplest but a lot of command related messaging also
// works this way. this helps in making the whole thing asynchronous and also
// easily scales to > 1 clients; when you get an answer you handle it, even if
// you didn't ask a question.
//
//
// EVENTS
//
// sooo im not really in the mood for writing documentation atm but this event
// pubsub thing (I think its pubsub but tbh the only thing I know about pubsub
// is what it stands for anyway judging from that I think this is pubsub :P) is
// getting out of hand i really need to write this down somewhere.
//
// soooooo.... ah yes there are loads of events flying around: websocket events
// and jquery events. this part is about the latter.
//
// window
//
//     there is one event that is triggered on the window object, it's the
//     newcmdcallback. i don't feel like explaining it here but you can search
//     the code for window.*on (and skip this sentence haha) and that should
//     explain it
//
// ctrl
//
//     all incoming websocket events are translated by the control object
//     (often (hopefully always) referred to by a var named ctrl) into jquery
//     events on itself. this part is pretty obvious and you can see how it
//     works by checking out Control.js and searching for ctrl.*on in other
//     parts of the code.
//
// cmd
//
//     the command object also generates jquery events of its own. they are
//     used by Viewers to subscribe to updates of the Model. these are detailed
//     in the documentation of the Command class.
//
//
// good luck.

define(["jquery",
        "lush/Ctrl",
        "lush/Command",
        "lush/Widget",
        "lush/terminal",
        "lush/path",
        "jsPlumb",
        "lush/utils"],
       function ($,
                 Ctrl,
                 Command,
                 Widget,
                 terminal,
                 path) {

    // websocket connection for control events
    var ctrl;

    // jQuery terminal plugin object
    var term;

    // sometimes i just dont know who i am anymore...
    var moi = guid();

    // build a <li> for the groups list for this command
    var createGroupsLi = function (cmd) {
        // TODO: this is not a good id(ea)
        var $li = $('<li id=group' + cmd.nid + '><span class=name></span></li>')
            .data('gid', cmd.nid);
        if (cmd.isRoot()) {
            $li.find('.name').text(cmd.nid + ': ' + groupname(cmd));
        } else {
            $li.addClass('child');
        }
        $(cmd).on('wasupdated', function (_, updata) {
            // if my name changes, so does the name of my group
            if (updata.name !== undefined) {
                // Set the text of this li to the name of whatever group I
                // belong to
                var gid = this.getGroupId();
                $('#group' + gid + ' .name')
                    .text(gid + ': ' + groupname(cmds[gid]));
            }
            if (updata.userdata && updata.userdata.archived) {
                $li.addClass('archived');
            }
        });
        $(cmd).on('parentAdded', function () {
            // I am now a child, hide my li
            $('#group' + this.nid).addClass('child');
        });
        $(cmd).on('parentRemoved', function () {
            // I'm back!
            $('#group' + this.nid).removeClass('child');
        });
        $(cmd).on('wasreleased', function () {
            $('#group' + this.nid).remove();
        });
        $li.append($('<button>').click(function (e) {
            e.preventDefault();
            // dont close, allows the vm to coalesce these handlers. I
            // actually don't know if js vms do this but it seems logical,
            // since it's not a closure.. given all the fuss about v8 I'd
            // expect at least that compiler to recognize this.
            // surprisingly enough this is not easy to google.
            var $li = $(this).closest('li');
            var cmd = cmds[$li.data('gid')];
            var currentState = $li.hasClass('archived');
            cmd.setArchivalState(!currentState);
        }));
        return $li;
    };

    // build the <div id=groups>
    var buildGroupsList = function () {
        // make a $li for every command, hide it if it's not root
        var lis = $.map(cmds, createGroupsLi);
        return $('#groups ul').append(lis);
    };

    var chdir = function (dir) {
        // this here is some tricky code dupe
        $.post("/chdir", {dir: dir})
            .fail(function (_, status, error) {
                alert(status + ": " + error);
            });
    };

    // print text to this terminal's output and mark it as coming from this
    // command. sets a class in the div that holds the output in the terminal.
    var termPrintlnCmd = function (term, sysid, data) {
        var finalize = function (container) {
            container.addClass('output-' + sysid);
        };
        return term.termPrintln(data, finalize);
    };

    // ask the server to create a new command. if second argument is passed, it
    // is called with the new command as the argument once the server responds
    var processCmd = function (options, callback) {
        if (options.cmd == "cd") {
            chdir(options.args[0]);
        } else {
            // ensure userdata is an object (rest of the code depends on this)
            if (!$.isPlainObject(options.userdata)) {
                options.userdata = {};
            }
            options.userdata.god = moi;
            if (callback !== undefined) {
                // subscribe to the "newcmdcallback" event in a unique
                // namespace. every new command will trigger the
                // "newcmdcallback" event (without namespace), which will
                // trigger all callbacks, including this one.
                var cbid = 'newcmdcallback.' + guid();
                options.userdata.callback = cbid;
                $(window).on(cbid, function (_, cmd) {
                    // namespaced jquery event, can be triggered spuriously.
                    // make sure that this command corresponds to this
                    // callback.
                    if (cmd.userdata.callback == cbid) {
                        callback(cmd);
                    }
                });
                // clear the callback after ten seconds. this means that the
                // server has ten seconds to generate a newcmd event, which
                // will trigger the newcmdcallback event. after that, the
                // callback is silently deleted. this is not great because the
                // callback has no way of knowing whether it timed out or not.
                setTimeout(function () {
                    $(window).off(cbid);
                }, 10000);
            }
            ctrl.send("new", JSON.stringify(options));
        }
    };

    // Handle what comes after the # on page load
    var processHash = function (h) {
        var i = h.indexOf(';');
        var rest = h.slice(i + 1);
        switch (h.slice(0, i)) {
        case "prompt":
            term.set_command(rest);
        }
    };

    var insertWidgetIntoDom = function (widget) {
        // wrap in a group div
        $('<div class=cmdgroup id=cmdgroup' + widget.cmd.nid + '>')
            .append(widget.node)
            .appendTo('#cmds');
    };

    $(document).ready(function () {
        // Control stream (Websocket)
        ctrl = new Ctrl();
        ctrl.ws.onerror = function () {
            console.log('Error connecting to ' + ctrluri);
        };
        $.each(cmds_init, function (_, cmdinit) {
            var cmd = new Command(ctrl, cmdinit, moi);
            cmds[cmdinit.nid] = cmd;
        });
        $.each(cmds, function (_, cmd) {
            var widget = new Widget(this);
            insertWidgetIntoDom(widget);
            widget.initJsPlumb(ctrl);
        });
        // second iteration to ensure all widgets exist before connecting them
        $.each(cmds, function (_, cmd) { cmd.updatePipes(); });
        buildGroupsList();
        $('<a href>show/hide archived</a>')
            .click(function (e) {
                e.preventDefault();
                $('#groups .archived').toggle();
            })
            .insertBefore('#groups ul');
        jsPlumb.importDefaults({
            ConnectionsDetachable: false,
            // Put all connectors at z-index 3 and endpoints at 4
            ConnectorZIndex: 3,
        });
        jsPlumb.bind("beforeDrop", function (info) {
            // Connected to another command
            connect(
                info.connection.endpoints[0],
                info.dropEndpoint,
                info.connection.getParameter("stream")());
            return false;
        });
        $('button#newcmd').click(function () {
            // create an empty command
            processCmd({});
        });
        $('.sortable').disableSelection().sortable();
        // a new command has been created
        $(ctrl).on("newcmd", function (_, cmdjson) {
            var cmdinit = JSON.parse(cmdjson);
            var cmd = new Command(this, cmdinit, moi);
            cmds[cmd.nid] = cmd;
            var widget = new Widget(cmd);
            insertWidgetIntoDom(widget);
            widget.initJsPlumb(this);
            delete cmdinit.nid;
            $('#groups ul').append(createGroupsLi(cmd));
            cmd.update(cmdinit);
            if (cmd.imadethis()) {
                // i made this!
                // capture all stdout and stderr to terminal
                var printer = function (_, data) {
                    termPrintlnCmd(term, cmd.nid, data);
                };
                // TODO: should only print when not piped to other cmd
                $(cmd).on('stdout.stream', printer);
                $(cmd).on('stderr.stream', printer);
                // subscribe to stream data
                this.send('subscribe', cmd.nid, 'stdout');
                this.send('subscribe', cmd.nid, 'stderr');
                var $widget = $('#' + cmd.htmlid);
                if (cmd.userdata.autostart) {
                    cmd.start();
                } else {
                    // If not autostarting, go directly into edit mode
                    $widget.tabs('option', 'active', 1);
                }
                // trigger all callbacks waiting for a newcmd event
                $(window).trigger('newcmdcallback', cmd);
            }
        });
        // command has been updated
        $(ctrl).on("updatecmd", function (_, updatajson) {
            var updata = JSON.parse(updatajson);
            var cmd = cmds[updata.nid];
            cmd.processUpdate(updata);
        });
        $(ctrl).on("cmd_released", function (_, idstr) {
            var nid = +idstr;
            var cmd = cmds[nid];
            cmd.processRelease();
            delete cmds[nid];
        });
        path($('form#path'), ctrl);
        term = terminal(processCmd);
        if (window.location.hash) {
            processHash(window.location.hash.slice(1));
        }
        // proxy the stream event to the command object
        // comes in as: stream;1;stdout;foo bar
        // the normal event handling causes the 'stream' event to trigger
        // that's this one. this handler will proxy that event to the command
        // object's processStream method.
        $(ctrl).on('stream', function (_, rawopts) {
            var opts = rawopts.splitn(';', 3);
            var sysid = opts[0];
            var stream = opts[1];
            var data = opts[2];
            cmds[sysid].processStream(stream, data);
        });
        // now that all widgets have been built (and most importantly: update
        // handlers have been set) populate the cmd objects to init the widgets
        $.each(cmds_init, function (nid, cmdinit) {
            cmds[nid].processUpdate(cmdinit);
        });
    });

});

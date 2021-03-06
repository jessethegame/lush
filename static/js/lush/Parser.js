// Copyright © 2014 Hraban Luyat <hraban@0brg.net>
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


// PROMPT PARSING

define(["lush/Ast",
        "lush/Lexer",],
       function (Ast, Lexer) {

    function startsWithDot(str) {
        return str[0] == ".";
    }

    // list of files matching a pattern. if showhidden is false this excludes files
    // starting with a dot. if showhidden is not specified this only shows those
    // files if the pattern itself starts with a dot.
    function glob(pattern, showhidden) {
        var files = [];
        $.ajax('/files.json', {
            data: {pattern: pattern},
            success: function (x) {
                files = x;
            },
            async: false});
        if (showhidden === undefined) {
            showhidden = startsWithDot(pattern);
        }
        if (!showhidden) {
            // hide files starting with a dot
            files = $.grep(files, startsWithDot, true);
        }
        return files;
    }

    // Simple interface, "parse everything at once" parser. No callbacks, no
    // state between calls, just call .parse("your command string"), and access
    // .ctx.firstast. or .ctx.ast for the last node.
    var Parser = function () {
        var parser = this;
        var lexer = new Lexer();
        parser._lexer = lexer;
        parser._ignoreErrors = false;
        // public parser state (TODO: make direct members)
        parser.ctx = {
            // the first parsed command, head of the linked list. pointer to the
            // next is in the "stdout" member of the ast node.
            firstast: undefined,
            // The command currently being parsed
            ast: undefined,
        };
        var ctx = parser.ctx; // shorthand
        lexer.oninit = function () {
            ctx.firstast = ctx.ast = new Ast();
        };
        lexer.onliteral = function (c) {
            // internal representation is escaped
            ctx.ast._newarg += Parser.Escape(c);
        };
        lexer.onglobQuestionmark = function () {
            ctx.ast.hasglob = true;
            ctx.ast._newarg += '?';
        };
        lexer.onglobStar = function () {
            ctx.ast.hasglob = true;
            ctx.ast._newarg += '*';
        };
        lexer.onboundary = function () {
            if (ctx.ast.hasglob) {
                var matches = glob(ctx.ast._newarg);
                // TODO: error if matches is empty
                ctx.ast.argv.push.apply(ctx.ast.argv, matches);
            } else {
                // undo internal escape representation
                ctx.ast.argv.push(Parser.Unescape(ctx.ast._newarg));
            }
            ctx.ast._newarg = '';
        };
        // encountered a | character
        lexer.onpipe = function () {
            // this is a fresh command
            var newast = new Ast();
            // which is the child of the previously parsed cmd
            ctx.ast.stdout = newast;
            // haiku
            ctx.ast = newast;
        };
        lexer.onerror = function (err, type) {
            if (!parser._ignoreErrors) {
                throw err;
            }
            switch (err.type) {
            case Lexer.ERRCODES.UNBALANCED_SINGLE_QUOTE:
                // ignore. can only happen at end of input, so finish up:
                lexer.onboundary();
                break;
            case Lexer.ERRCODES.UNBALANCED_DOUBLE_QUOTE:
                // ignore
                lexer.onboundary();
                break;
            case Lexer.ERRCODES.TERMINATING_BACKSLASH:
                // ignore!
                lexer.onboundary();
                break;
            default:
                throw "unknown parser error: " + err;
            }
        };
    };

    Parser.prototype.parse = function (txt, ignoreParseErrors) {
        var parser = this;
        if (typeof txt !== "string") {
            throw "Parser.parse() requires text to parse";
        }
        parser._ignoreErrors = ignoreParseErrors;
        parser._lexer.parse(txt);
        return parser.ctx.firstast;
    };

    // TODO: behold, a code smell. why is it a public class method? because i
    // need it in other files (cli) to encode data before sending it to the
    // server. why dont i just define them there, then, instead of here? because
    // I need them here to escape data internally. why do i escape data
    // internally? I forgot, but the point is, internal encoding of this parser
    // and the encoding (escaping) for the server happens to be the same, so I
    // want to use the same functions, even though they're not, they just happen
    // to behave the same way, but in lala-land, they're different concepts.

    // CLASS METHOD (blegh)
    // prefix all special chars in arg by backslash
    Parser.Escape = function (txt) {
        return txt.replace(/([\\?*\s"'])/g, "\\$1");
    };

    // CLASS METHOD
    // undo Parser.Escape
    Parser.Unescape = function (txt) {
        return txt.replace(/\\(.)/g, "$1");
    };

    return Parser;
});

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

test("lcp(): longest common prefix", function () {
    equal(lcp(["abcd", "abab", "abba"]), "ab");
    equal(lcp([]), "", "common prefix of 0 strings");
    equal(lcp(["foo", "bar"]), "");
    equal(lcp(["", "foo"]), "");
    equal(lcp(["burt", "burt"]), "burt");
});

test("splitn(): split string with limit", function () {
    deepEqual("a,b,c,d".splitn(",", 3), ['a', 'b', 'c,d']);
    deepEqual("a,b,c,d".splitn(",", 9), ['a', 'b', 'c', 'd']);
    deepEqual("a,b,c,d".splitn(",", 1), ['a,b,c,d']);
    deepEqual("foo".splitn("", 2), ['f', 'oo']);
    deepEqual("".splitn(",", 1), [""]);
    deepEqual("".splitn("", 1), []);
});

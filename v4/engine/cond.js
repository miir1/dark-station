// 어두운 역 v4 — 조건식. 표의 cond/when/rule/skipIf 열을 읽는다. eval 없음.
// 문법:  식 := 항 ( ('&' | '|') 항 )*      & 가 | 보다 먼저 묶인다
//        항 := '!'? ( 'flag:이름' | 이름 | 이름 연산자 값 )
//        연산자 := == != >= <= > <          값 := 정수 | 이름(문자 비교)
//        빈칸 · '-' · 'always' 는 참.   예) "day==5&night" "hunger>=7" "share<=-2 & hand>=2" "flag:parts_hidden"
(function (root) {
  'use strict';

  const TOKEN = /\s*(&|\||!|==|!=|>=|<=|>|<|\(|\)|flag:[a-z0-9_]+|-?\d+|[A-Za-z_][A-Za-z0-9_]*)\s*/y;

  function tokenize(src) {
    const out = [];
    TOKEN.lastIndex = 0;
    let m;
    let pos = 0;
    while (pos < src.length) {
      TOKEN.lastIndex = pos;
      m = TOKEN.exec(src);
      if (!m) throw new Error(`조건식 해석 불가: "${src}" (${pos}번째 글자)`);
      out.push(m[1]);
      pos = TOKEN.lastIndex;
    }
    return out;
  }

  // 파싱 → 트리. { op:'and'|'or'|'not'|'cmp'|'flag'|'truthy', ... }
  function parse(src) {
    if (src == null) return { op: 'true' };
    const s = String(src).trim();
    if (s === '' || s === '-' || s === 'always') return { op: 'true' };
    const t = tokenize(s);
    let i = 0;
    const peek = () => t[i];
    const next = () => t[i++];
    function primary() {
      const tok = next();
      if (tok === undefined) throw new Error(`조건식이 끝나지 않음: "${src}"`);
      if (tok === '!') return { op: 'not', a: primary() };
      if (tok === '(') { const e = orExpr(); if (next() !== ')') throw new Error(`괄호 닫힘 없음: "${src}"`); return e; }
      if (tok.startsWith('flag:')) return { op: 'flag', name: tok.slice(5) };
      if (!/^[A-Za-z_]/.test(tok)) throw new Error(`이름이 와야 함: "${tok}" in "${src}"`);
      const op = peek();
      if (['==', '!=', '>=', '<=', '>', '<'].includes(op)) {
        next();
        const v = next();
        if (v === undefined || !/^(-?\d+|[A-Za-z_][A-Za-z0-9_]*)$/.test(v)) throw new Error(`비교 값 없음: "${src}"`);
        return { op: 'cmp', name: tok, cmp: op, value: /^-?\d+$/.test(v) ? Number(v) : v };
      }
      return { op: 'truthy', name: tok };
    }
    function andExpr() { let a = primary(); while (peek() === '&') { next(); a = { op: 'and', a, b: primary() }; } return a; }
    function orExpr() { let a = andExpr(); while (peek() === '|') { next(); a = { op: 'or', a, b: andExpr() }; } return a; }
    const tree = orExpr();
    if (i < t.length) throw new Error(`조건식에 남는 토큰 "${t[i]}": "${src}"`);
    return tree;
  }

  // 식에 나오는 이름 전부(검증용: 금지 이름·모르는 이름 찾기)
  function names(tree, out) {
    out = out || [];
    if (!tree) return out;
    if (tree.op === 'cmp' || tree.op === 'truthy') out.push(tree.name);
    if (tree.op === 'flag') out.push('flag:' + tree.name);
    if (tree.a) names(tree.a, out);
    if (tree.b) names(tree.b, out);
    return out;
  }

  // ctx: { 이름: 값, flags: {이름: true} }  — 모르는 이름은 0/거짓
  function evalTree(tree, ctx) {
    switch (tree.op) {
      case 'true': return true;
      case 'and': return evalTree(tree.a, ctx) && evalTree(tree.b, ctx);
      case 'or': return evalTree(tree.a, ctx) || evalTree(tree.b, ctx);
      case 'not': return !evalTree(tree.a, ctx);
      case 'flag': return !!(ctx.flags && ctx.flags[tree.name]);
      case 'truthy': { const v = ctx[tree.name]; return v !== undefined && v !== null && v !== 0 && v !== false && v !== ''; }
      case 'cmp': {
        const v = ctx[tree.name];
        const a = v === undefined || v === null ? 0 : v;
        const b = tree.value;
        if (typeof b === 'number') {
          const n = typeof a === 'number' ? a : (a === true ? 1 : a === false ? 0 : Number(a) || 0);
          switch (tree.cmp) { case '==': return n === b; case '!=': return n !== b; case '>=': return n >= b; case '<=': return n <= b; case '>': return n > b; case '<': return n < b; }
        }
        const sa = String(a);
        if (tree.cmp === '==') return sa === b;
        if (tree.cmp === '!=') return sa !== b;
        return false;
      }
      default: return false;
    }
  }

  const cache = new Map();
  function compile(src) {
    const key = src == null ? '' : String(src);
    let tree = cache.get(key);
    if (!tree) { tree = parse(key); cache.set(key, tree); }
    return tree;
  }
  const test = (src, ctx) => evalTree(compile(src), ctx || {});

  const API = { parse, compile, test, names, evalTree };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else (root.DS4 = root.DS4 || {}).cond = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

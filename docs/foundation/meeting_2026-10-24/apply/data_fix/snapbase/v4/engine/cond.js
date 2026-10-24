// 어두운 역 v4 — 조건식. 표의 cond/when/rule/skipIf/context 열을 읽는다. eval 없음.
// 문법:  식 := 항 ( ('&' | '|') 항 )*      & 가 | 보다 먼저 묶인다. 괄호 허용.
//        항 := '!'? ( 이름 | 이름 연산자 값 )
//        이름 := 글자 [글자·숫자·_·.]*  또는  접두:이름   (접두 = flag inspect trace talk alive … 아무 소문자 낱말)
//        연산자 := == != >= <= > <          값 := 정수 | 이름(문자 비교) | '' (빈 글, == != 만)
//        빈칸 · '-' · 'always' 는 참.
// 예) "day==5 & phase==night"  "hunger>=7"  "share<=-2 & hand>=2"  "flag:parts_hidden"  "trace:lever==up"  "inspect:bag"  "alive:soonrye"  "needs.hunger>=7"
// 값 찾기(ctx): 이름 그대로(ctx['trace:lever']) → 접두 묶음(ctx.trace.lever, flag 는 ctx.flags) → 점 뒤 마지막 낱말(ctx.hunger). 없으면 0/거짓.
(function (root) {
  'use strict';

  const NAME = '[A-Za-z_][A-Za-z0-9_.]*(?::[A-Za-z0-9_.]+)?';
  const TOKEN = new RegExp('\\s*(&|\\||==|!=|>=|<=|>|<|!|\\(|\\)|-?\\d+|\'\'|""|' + NAME + ')\\s*', 'y');   // != 를 ! 보다 먼저. ''·"" = 빈 글
  const IS_NAME = new RegExp('^' + NAME + '$');

  function tokenize(src) {
    const out = [];
    let pos = 0;
    while (pos < src.length) {
      TOKEN.lastIndex = pos;
      const m = TOKEN.exec(src);
      if (!m) throw new Error(`조건식 해석 불가: "${src}" (${pos}번째 글자)`);
      out.push(m[1]);
      pos = TOKEN.lastIndex;
    }
    return out;
  }

  // 파싱 → 트리. { op:'and'|'or'|'not'|'cmp'|'truthy'|'true', ... }
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
      if (!IS_NAME.test(tok)) throw new Error(`이름이 와야 함: "${tok}" in "${src}"`);
      const op = peek();
      if (['==', '!=', '>=', '<=', '>', '<'].includes(op)) {
        next();
        const v = next();
        if (v === undefined || !(/^-?\d+$/.test(v) || IS_NAME.test(v) || v === "''" || v === '""')) throw new Error(`비교 값 없음: "${src}"`);
        if ((v === "''" || v === '""') && op !== '==' && op !== '!=') throw new Error(`빈 글은 == / != 로만 비교: "${src}"`);
        return { op: 'cmp', name: tok, cmp: op, value: /^-?\d+$/.test(v) ? Number(v) : (v === "''" || v === '""') ? '' : v };
      }
      return { op: 'truthy', name: tok };
    }
    function andExpr() { let a = primary(); while (peek() === '&') { next(); a = { op: 'and', a, b: primary() }; } return a; }
    function orExpr() { let a = andExpr(); while (peek() === '|') { next(); a = { op: 'or', a, b: andExpr() }; } return a; }
    const tree = orExpr();
    if (i < t.length) throw new Error(`조건식에 남는 토큰 "${t[i]}": "${src}"`);
    return tree;
  }

  // 식에 나오는 이름 전부(검증용: 금지 이름·모르는 이름 찾기). 접두가 있으면 "접두:이름" 그대로.
  function names(tree, out) {
    out = out || [];
    if (!tree) return out;
    if (tree.op === 'cmp' || tree.op === 'truthy') out.push(tree.name);
    if (tree.a) names(tree.a, out);
    if (tree.b) names(tree.b, out);
    return out;
  }
  const prefixOf = (name) => (name.includes(':') ? name.split(':')[0] : '');

  function get(ctx, name) {
    if (ctx[name] !== undefined) return ctx[name];
    const c = name.indexOf(':');
    if (c > 0) {
      const p = name.slice(0, c), rest = name.slice(c + 1);
      const bag = ctx[p] !== undefined ? ctx[p] : (p === 'flag' ? ctx.flags : undefined);
      if (bag && typeof bag === 'object' && bag[rest] !== undefined) return bag[rest];
      return undefined;
    }
    const d = name.lastIndexOf('.');
    if (d > 0) { const last = name.slice(d + 1); const head = ctx[name.slice(0, d)]; if (head && typeof head === 'object' && head[last] !== undefined) return head[last]; return ctx[last]; }
    return undefined;
  }
  const truthy = (v) => v !== undefined && v !== null && v !== 0 && v !== false && v !== '' && v !== 'none';

  function evalTree(tree, ctx) {
    switch (tree.op) {
      case 'true': return true;
      case 'and': return evalTree(tree.a, ctx) && evalTree(tree.b, ctx);
      case 'or': return evalTree(tree.a, ctx) || evalTree(tree.b, ctx);
      case 'not': return !evalTree(tree.a, ctx);
      case 'truthy': return truthy(get(ctx, tree.name));
      case 'cmp': {
        const v = get(ctx, tree.name);
        const a = v === undefined || v === null ? 0 : v;
        const b = tree.value;
        if (typeof b === 'number') {
          const n = typeof a === 'number' ? a : (a === true ? 1 : a === false ? 0 : Number(a) || 0);
          switch (tree.cmp) { case '==': return n === b; case '!=': return n !== b; case '>=': return n >= b; case '<=': return n <= b; case '>': return n > b; case '<': return n < b; }
        }
        const sa = v === undefined || v === null ? (b === '' ? '' : 'none') : String(a);   // 빈 글 비교(=='' / !='')에서는 없는 값도 빈 글
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

  const API = { parse, compile, test, names, evalTree, get, prefixOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else (root.DS4 = root.DS4 || {}).cond = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

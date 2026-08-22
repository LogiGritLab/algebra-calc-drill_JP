/**
 * 正負の数・数式の四則演算練習サイト
 */

const TXT = {
  prompt: 'この計算の答えはどれ？',
  choiceLabel: '選択肢',
  ansLabel: '【答え】',
  explLabel: '【解説】',
  nextBtn: '次へ (Enter) ⏎',
  correct: '正解',
  incorrect: '不正解',
  ansTitleCorrect: '正解！',
  ansTitleWrong: '不正解... 正解は:'
};

/* ========== DOM ========== */
const typeMenu = document.getElementById('typeMenu');
const opMenu = document.getElementById('opMenu');
const varMenu = document.getElementById('varMenu');
const questionArea = document.getElementById('questionArea');
const explanationEl = document.getElementById('explanation');
const correctCountEl = document.getElementById('correctCount');
const wrongCountEl = document.getElementById('wrongCount');
const streakCountEl = document.getElementById('streakCount');
const resetBtn = document.getElementById('resetBtn');

/* ========== State ========== */
let currentType = 'mono';   // num | mono | poly
let currentOp = 'addsub';   // addsub | mul | div
let currentVars = 1;        // 1 | 2 | 3
let correctCount = 0;
let wrongCount = 0;
let streak = 0;
let locked = false;
let currentProblem = null;

/* ========== Utils ========== */
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) { let t = b; b = a % b; a = t; }
  return Math.max(1, a);
}
function renderKatex(tex, displayMode = false) {
  if (typeof katex === 'undefined') return `<span class="tex-fallback">${tex}</span>`;
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode, strict: 'ignore' });
  } catch {
    return `<span class="tex-fallback">${tex}</span>`;
  }
}
function cleanSigns(str) {
  return str.replace(/\+\s*-/g, '- ').replace(/-\s*-/g, '+ ');
}

/* ========== Algebra Engine ========== */
function cloneTerm(t) { return { c: t.c, x: t.x || 0, y: t.y || 0, z: t.z || 0 }; }
function isSameTerms(t1, t2) { return t1.x === t2.x && t1.y === t2.y && t1.z === t2.z; }
function termCompare(a, b) {
  if (a.x !== b.x) return b.x - a.x;
  if (a.y !== b.y) return b.y - a.y;
  return b.z - a.z;
}
function simplify(poly) {
  let res = [];
  for (let t of poly) {
    let found = res.find(rt => isSameTerms(rt, t));
    if (found) found.c += t.c;
    else res.push(cloneTerm(t));
  }
  return res.filter(t => t.c !== 0).sort(termCompare);
}
function polyAdd(A, B) { return simplify([...A, ...B]); }
function polySub(A, B) { return simplify([...A, ...B.map(t => ({ ...t, c: -t.c }))]); }
function termMul(t1, t2) {
  return { c: t1.c * t2.c, x: (t1.x||0) + (t2.x||0), y: (t1.y||0) + (t2.y||0), z: (t1.z||0) + (t2.z||0) };
}
function polyMul(A, B) {
  let res = [];
  for (let a of A) for (let b of B) res.push(termMul(a, b));
  return simplify(res);
}
function degX(poly) {
  if (poly.length === 0) return -1;
  return Math.max(...poly.map(t => t.x));
}

// Format Poly to TeX
function formatTerm(t, isFirst, forceSign = false) {
  if (t.c === 0) return "";
  let absC = Math.abs(t.c);
  let varsExist = t.x > 0 || t.y > 0 || t.z > 0;
  let cStr = (absC === 1 && varsExist) ? "" : absC.toString();
  let sign = t.c < 0 ? "-" : ((isFirst && !forceSign) ? "" : "+");
  let xStr = t.x === 0 ? "" : (t.x === 1 ? "x" : `x^{${t.x}}`);
  let yStr = t.y === 0 ? "" : (t.y === 1 ? "y" : `y^{${t.y}}`);
  let zStr = t.z === 0 ? "" : (t.z === 1 ? "z" : `z^{${t.z}}`);
  let vars = xStr + yStr + zStr;
  let body = cStr + vars;
  if (body === "") body = "1";
  return sign + body;
}

function polyToTex(poly) {
  if (poly.length === 0) return "0";
  let tex = "";
  for (let i = 0; i < poly.length; i++) tex += formatTerm(poly[i], i === 0);
  return tex;
}
function parens(tex) { return `(${tex})`; }
function parensIfNeg(poly) {
  let t = polyToTex(poly);
  if (poly.length === 1 && poly[0].c < 0) return parens(t);
  return t;
}
function parensIfPolyOrNeg(poly) {
  if (poly.length > 1) return parens(polyToTex(poly));
  return parensIfNeg(poly);
}

// Format fraction for monomial division
function monoDivTex(A, B) {
  let sign = (A.c * B.c < 0) ? "-" : "";
  let cA = Math.abs(A.c); let cB = Math.abs(B.c);
  let g = gcd(cA, cB);
  cA /= g; cB /= g;
  
  let dx = (A.x||0) - (B.x||0);
  let dy = (A.y||0) - (B.y||0);
  let dz = (A.z||0) - (B.z||0);
  
  let numVars = "";
  if(dx > 0) numVars += (dx===1 ? "x" : `x^{${dx}}`);
  if(dy > 0) numVars += (dy===1 ? "y" : `y^{${dy}}`);
  if(dz > 0) numVars += (dz===1 ? "z" : `z^{${dz}}`);
  
  let denVars = "";
  if(dx < 0) denVars += (dx===-1 ? "x" : `x^{${-dx}}`);
  if(dy < 0) denVars += (dy===-1 ? "y" : `y^{${-dy}}`);
  if(dz < 0) denVars += (dz===-1 ? "z" : `z^{${-dz}}`);
  
  if (denVars === "") {
    let frac = "";
    if (cB === 1) frac = cA.toString();
    else frac = `\\dfrac{${cA}}{${cB}}`;
    if (frac === "1" && numVars !== "") frac = ""; 
    return sign + frac + numVars;
  } else {
    let numStr = cA === 1 && numVars !== "" ? numVars : cA.toString() + numVars;
    let denStr = cB === 1 && denVars !== "" ? denVars : cB.toString() + denVars;
    if (numStr === "") numStr = "1";
    return sign + `\\dfrac{${numStr}}{${denStr}}`;
  }
}

function ansToTex(type, realOp, ansObj) {
  if (type === 'num') return ansObj.toString();
  if (realOp === 'div' && type === 'poly') {
    let qTex = polyToTex(ansObj.Q);
    let rTex = polyToTex(ansObj.R);
    return `\\text{商 } ${qTex} \\quad \\text{余り } ${rTex}`;
  } else if (realOp === 'div' && type === 'mono') {
    return monoDivTex(ansObj.A, ansObj.B);
  } else {
    return polyToTex(ansObj);
  }
}

function polyToStringKey(poly) {
  if(!Array.isArray(poly)) return JSON.stringify(poly);
  return poly.map(t => `${t.c},${t.x},${t.y},${t.z}`).join('|');
}
function ansKey(type, realOp, ansObj) {
  if (type === 'num') return ansObj.toString();
  if (realOp === 'div' && type === 'poly') return polyToStringKey(ansObj.Q) + "||" + polyToStringKey(ansObj.R);
  if (realOp === 'div' && type === 'mono') return `${ansObj.A.c}/${ansObj.B.c}|${ansObj.A.x-ansObj.B.x},${ansObj.A.y-ansObj.B.y},${ansObj.A.z-ansObj.B.z}`;
  return polyToStringKey(ansObj);
}

/* ========== Generators ========== */
function genTerm(vars, forceXDeg = null, maxTotal = 6, cLimit = 5, avoidOne = false, maxPow = 3) {
  let c = randInt(-cLimit, cLimit);
  if (c === 0) c = pick([2, -2, 3, -3]);
  if (avoidOne && Math.abs(c) === 1) {
    let sign = c < 0 ? -1 : 1;
    c = pick([2, 3, 4]) * sign;
  }

  let x = 0, y = 0, z = 0;
  let rem = maxTotal;
  if (forceXDeg !== null) {
    x = forceXDeg;
    rem -= x;
  } else if (vars === 1) {
    x = randInt(0, Math.min(maxPow, rem));
    rem -= x;
  }
  
  if (vars >= 2 && rem > 0) {
    y = randInt(0, Math.min(maxPow, rem));
    rem -= y;
  }
  if (vars >= 3 && rem > 0) {
    z = randInt(0, Math.min(maxPow, rem));
  }
  return { c, x, y, z };
}

function formatMulExp(varName, dA, dB) {
  if (dA === 0 && dB === 0) return "";
  if (dA > 0 && dB > 0) return `\\cdot ${varName}^{${dA}+${dB}}`;
  let d = dA > 0 ? dA : dB;
  if (d === 1) return `\\cdot ${varName}`;
  return `\\cdot ${varName}^{${d}}`;
}

function makeProblem() {
  let type = currentType;
  let rawOp = currentOp;
  let realOp = rawOp === 'addsub' ? pick(['add', 'sub']) : rawOp;
  let vars = currentVars;
  
  let qTex = "";
  let ansObj = null;
  let explanation = [];
  let stepsDiv = null;
  let isMul = (realOp === 'mul');
  let hasDot = false;
  
  if (type === 'num') {
    if (realOp === 'add' || realOp === 'sub') {
      let a = randInt(-12, 12); if (a === 0) a = pick([3, -4, 5]);
      let b = randInt(-12, 12); if (b === 0) b = pick([4, -5, 6]);
      
      // プラス同士を除外
      if (a > 0 && b > 0) {
        if (Math.random() < 0.5) a = -a; else b = -b;
      }
      
      ansObj = realOp === 'add' ? a + b : a - b;
      let opSign = realOp === 'add' ? '+' : '-';
      let bStr = b < 0 ? `(${b})` : b;
      qTex = `${a} ${opSign} ${bStr}`;
      explanation.push(`符号に注意して計算します。`);
      
      let intermediate = "";
      if (realOp === 'add') {
        if (b < 0) intermediate = `${a} - ${Math.abs(b)}`;
        else intermediate = `${a} + ${b}`;
      } else {
        if (b < 0) intermediate = `${a} + ${Math.abs(b)}`;
        else intermediate = `${a} - ${b}`;
      }
      let qClean = cleanSigns(qTex);
      
      if (qClean.replace(/\s+/g, '') === intermediate.replace(/\s+/g, '')) {
        explanation.push(`$$ ${qClean} = ${ansObj} $$`);
      } else {
        explanation.push(`$$ ${qClean} = ${intermediate} = ${ansObj} $$`);
      }
    } else if (realOp === 'mul') {
      let a = randInt(-9, 9); if(Math.abs(a) <= 1) a = pick([2, -3, 4, -5]);
      let b = randInt(-9, 9); if(Math.abs(b) <= 1) b = pick([3, -4, 5, -6]);
      
      // プラス同士を除外
      if (a > 0 && b > 0) {
        if (Math.random() < 0.5) a = -a; else b = -b;
      }
      
      ansObj = a * b;
      let bStr = b < 0 ? `(${b})` : b;
      qTex = `${a} \\times ${bStr}`;
      
      explanation.push(`数の正負に注意して計算します。`);
      if (!(a > 0 && b > 0)) {
        let signA = a > 0 ? 'プラス' : 'マイナス';
        let signB = b > 0 ? 'プラス' : 'マイナス';
        let signAns = ansObj > 0 ? 'プラス' : 'マイナス';
        explanation.push(`${signA}と${signB}を掛けると${signAns}になります。`);
      }
      explanation.push(`$$ ${a} \\times ${bStr} = ${ansObj} $$`);
    } else if (realOp === 'div') {
      let b = randInt(-9, 9); if(Math.abs(b) <= 1) b = pick([2, -3, 4, -5]);
      let ans = randInt(-9, 9); if(ans === 0) ans = pick([2, -3, 4]);
      let a = ans * b;
      
      // プラス同士を除外
      if (ans > 0 && b > 0) {
        if (Math.random() < 0.5) { ans = -ans; a = ans * b; }
        else { b = -b; a = ans * b; }
      }
      
      ansObj = ans;
      let bStr = b < 0 ? `(${b})` : b;
      qTex = `${a} \\div ${bStr}`;
      
      explanation.push(`数の正負に注意して計算します。`);
      if (!(a > 0 && b > 0)) {
        let signA = a > 0 ? 'プラス' : 'マイナス';
        let signB = b > 0 ? 'プラス' : 'マイナス';
        let signAns = ansObj > 0 ? 'プラス' : 'マイナス';
        explanation.push(`${signA}を${signB}で割ると${signAns}になります。`);
      }
      let invB = b < 0 ? `\\left(-\\dfrac{1}{${Math.abs(b)}}\\right)` : `\\dfrac{1}{${b}}`;
      explanation.push(`$$ ${a} \\div ${bStr} = ${a} \\times ${invB} = ${ansObj} $$`);
    }
  } else if (type === 'mono') {
    let A, B;
    if (realOp === 'add' || realOp === 'sub') {
      A = genTerm(vars, null, 6, 5, true, 3); 
      if (vars >= 1) A.x = Math.max(1, A.x || 0);
      if (vars >= 2) A.y = Math.max(1, A.y || 0);
      if (vars >= 3) A.z = Math.max(1, A.z || 0);
      
      B = cloneTerm(A);
      B.c = randInt(-5, 5);
      if (B.c === 0 || B.c === A.c || (realOp === 'add' && B.c === -A.c) || (realOp === 'sub' && B.c === A.c)) {
        B.c = A.c > 0 ? -A.c - 1 : Math.abs(A.c) + 1;
      }
      ansObj = realOp === 'add' ? polyAdd([A], [B]) : polySub([A], [B]);
      let opSign = realOp === 'add' ? "+" : "-";
      qTex = `${parensIfNeg([A])} ${opSign} ${parensIfNeg([B])}`;
      
    let midB = cloneTerm(B);
      if (realOp === 'sub') midB.c = -midB.c;
      let midTexClean = cleanSigns(polyToTex([A, midB]));
      let qTexClean = cleanSigns(qTex);
      
      if (qTexClean.replace(/\s+/g, '') === midTexClean.replace(/\s+/g, '')) {
        explanation.push(`$$ ${qTexClean} = ${polyToTex(ansObj)} $$`);
      } else {
        explanation.push(`$$ ${qTex} = ${midTexClean} = ${polyToTex(ansObj)} $$`);
      }
    } else if (realOp === 'mul') {
      A = genTerm(vars, null, 6, 5, true, 3);
      B = genTerm(vars, null, 6, 5, true, 3);
      
      // AもBも必ず文字を含むようにする
      if (A.x === 0 && A.y === 0 && A.z === 0) {
        let t = pick(vars === 1 ? ['x'] : vars === 2 ? ['x', 'y'] : ['x', 'y', 'z']);
        A[t] = randInt(1, 3);
      }
      if (B.x === 0 && B.y === 0 && B.z === 0) {
        let t = pick(vars === 1 ? ['x'] : vars === 2 ? ['x', 'y'] : ['x', 'y', 'z']);
        B[t] = randInt(1, 3);
      }

      // xやyが欠けていたら補う
      if (vars >= 2) {
         if (A.x === 0 && B.x === 0) { (Math.random()<0.5?A:B).x = randInt(1, 2); }
         if (A.y === 0 && B.y === 0) { (Math.random()<0.5?A:B).y = randInt(1, 2); }
      }
      if (vars === 3) {
         if (A.z === 0 && B.z === 0) { (Math.random()<0.5?A:B).z = randInt(1, 2); }
      }
      
      ansObj = polyMul([A], [B]);
      
      let aTex = polyToTex([A]);
      let bTex = parensIfNeg([B]);
      qTex = `${aTex} \\cdot ${bTex}`;
      hasDot = true;
      
      explanation.push(`単項式の掛け算では、係数同士、同じ文字同士を掛け合わせます。`);
      explanation.push(`$a^m \\cdot a^n = a^{m+n}$ が成り立ちます。`);
      let bStr = B.c < 0 ? `(${B.c})` : B.c;
      
      let xExp = formatMulExp('x', A.x||0, B.x||0);
      let yExp = vars >= 2 ? formatMulExp('y', A.y||0, B.y||0) : "";
      let zExp = vars >= 3 ? formatMulExp('z', A.z||0, B.z||0) : "";
      
      explanation.push(`$$ ${qTex} = (${A.c} \\times ${bStr}) ${xExp} ${yExp} ${zExp} = ${polyToTex(ansObj)} $$`);
    } else if (realOp === 'div') {
      A = genTerm(vars, null, 6, 8, true, 4);
      B = genTerm(vars, null, 5, 6, true, 3);

      if (A.x === 0 && A.y === 0 && A.z === 0) {
        let t = pick(vars === 1 ? ['x'] : vars === 2 ? ['x', 'y'] : ['x', 'y', 'z']);
        A[t] = randInt(1, 3);
      }
      if (B.x === 0 && B.y === 0 && B.z === 0) {
        let t = pick(vars === 1 ? ['x'] : vars === 2 ? ['x', 'y'] : ['x', 'y', 'z']);
        B[t] = randInt(1, 3);
      }

      if (vars >= 1 && A.x === 0 && B.x === 0) A.x = 1;
      if (vars >= 2 && A.y === 0 && B.y === 0) A.y = 1;
      if (vars >= 3 && A.z === 0 && B.z === 0) A.z = 1;

      ansObj = { A, B };
      qTex = `${polyToTex([A])} \\div ${parensIfNeg([B])}`;
      
      explanation.push(`単項式の割り算では、分数にして係数と文字をそれぞれ約分します。`);
      explanation.push(`$$ ${qTex} = \\dfrac{${polyToTex([A])}}{${polyToTex([B])}} = ${monoDivTex(A, B)} $$`);
    }
  } else {
    // poly
    if (realOp === 'add' || realOp === 'sub') {
      let isLinear = Math.random() < 0.7;
      let d2 = isLinear ? 1 : 2;
      let P1, P2;
      do {
        P1 = [genTerm(vars, d2, d2+1, 4, false, d2)];
        if (d2 === 2 && Math.random() < 0.5) P1.push(genTerm(vars, 1, 2, 4, false, 1));
        else if (d2 === 1 && Math.random() < 0.8) P1.push(genTerm(vars, 0, 1, 4, false, 0));
        if (P1.length < 3 && Math.random() < 0.5) P1.push(genTerm(vars, 0, 1, 4, false, 0));
        
        if (vars >= 1 && P1[0]) P1[0].x = Math.max(1, P1[0].x || 0);
        P1 = simplify(P1).slice(0, 3);
        
        P2 = [genTerm(vars, d2, d2+1, 4, false, d2)];
        if (d2 === 2 && Math.random() < 0.5) P2.push(genTerm(vars, 1, 2, 4, false, 1));
        else if (d2 === 1 && Math.random() < 0.8) P2.push(genTerm(vars, 0, 1, 4, false, 0));
        if (P2.length < 3 && Math.random() < 0.5) P2.push(genTerm(vars, 0, 1, 4, false, 0));
        P2 = simplify(P2).slice(0, 3);
      } while (P1.length < 2 || P2.length < 2);

      let c1 = pick([1, 2, 3]); let c2 = pick([1, 2, 3]);
      
      let p1Tex = c1 === 1 ? parens(polyToTex(P1)) : `${c1}${parens(polyToTex(P1))}`;
      let p2Tex = c2 === 1 ? parens(polyToTex(P2)) : `${c2}${parens(polyToTex(P2))}`;
      let opSign = realOp === 'add' ? '+' : '-';
      qTex = `${p1Tex} ${opSign} ${p2Tex}`;
      
      let expP1 = polyMul([{c:c1, x:0, y:0, z:0}], P1);
      let expP2 = polyMul([{c:c2, x:0, y:0, z:0}], P2);
      ansObj = realOp === 'add' ? polyAdd(expP1, expP2) : polySub(expP1, expP2);
      
      explanation.push(`分配法則（ $A(B+C)=AB+AC$ ）を使ってカッコを外します。`);
      let exp2Tex = realOp === 'add' ? polyToTex(expP2) : polyToTex(expP2.map(t=>({...t, c: -t.c})));
      let combined = polyToTex(expP1) + (exp2Tex.startsWith('-') ? exp2Tex : `+${exp2Tex}`);
      explanation.push(`$$ ${qTex} = ${cleanSigns(combined)} $$`);
      explanation.push(`$$ = ${polyToTex(ansObj)} $$`);
    } else if (realOp === 'mul') {
      let isMonoPoly = Math.random() < 0.5;
      let isLinear = Math.random() < 0.8;
      let d2 = isLinear ? 1 : 2;
      let P1, P2;
      if (isMonoPoly) {
        do {
          P1 = [genTerm(vars, null, 1, 4, true, 1)];
          if (P1[0].x === 0 && P1[0].y === 0 && P1[0].z === 0) {
            let t = pick(vars === 1 ? ['x'] : vars === 2 ? ['x', 'y'] : ['x', 'y', 'z']);
            P1[0][t] = 1;
          }
          P2 = [genTerm(vars, d2, d2+1, 4, false, d2)];
          if (d2 === 2 && Math.random() < 0.5) P2.push(genTerm(vars, 1, 2, 4, false, 1));
          else if (d2 === 1 && Math.random() < 0.8) P2.push(genTerm(vars, 0, 1, 4, false, 0));
          if (P2.length < 3 && Math.random() < 0.5) P2.push(genTerm(vars, 0, 1, 4, false, 0));
          P2 = simplify(P2).slice(0, 3);
        } while (P2.length < 2);
        
        explanation.push(`分配法則（ $A(B+C) = AB + AC$ ）を使って計算します。`);
        ansObj = polyMul(P1, P2);
        
        let p1t = polyToTex(P1);
        if (P1.length === 1 && P1[0].x === 0 && P1[0].y === 0 && P1[0].z === 0) {
          qTex = `${p1t}${parens(polyToTex(P2))}`;
        } else {
          qTex = `${p1t} \\cdot ${parens(polyToTex(P2))}`;
          hasDot = true;
        }
        
        let expanded = [];
        for(let a of P1) for(let b of P2) expanded.push(polyToTex([termMul(a, b)]));
        let expTex = cleanSigns(expanded.join(" + "));
        
        explanation.push(`$$ ${qTex} = ${expTex} $$`);
        explanation.push(`$$ = ${polyToTex(ansObj)} $$`);
      } else {
        do {
          P1 = simplify([genTerm(vars, 1, 2, 3, false, 1), genTerm(vars, 0, 1, 3, false, 0)]).slice(0, 2);
          P2 = simplify([genTerm(vars, 1, 2, 3, false, 1), genTerm(vars, 0, 1, 3, false, 0)]).slice(0, 2);
          if (vars >= 1 && P1.every(t=>!t.x) && P2.every(t=>!t.x)) P1[0].x = Math.max(1, P1[0].x || 0);
          P1 = simplify(P1); P2 = simplify(P2);
        } while (P1.length < 2 || P2.length < 2);
        explanation.push(`展開公式（ $(a+b)(c+d) = ac+ad+bc+bd$ ）を使って計算します。`);
        
        ansObj = polyMul(P1, P2);
        qTex = `${parensIfPolyOrNeg(P1)}${parens(polyToTex(P2))}`;
        
        let expanded = [];
        for(let a of P1) for(let b of P2) expanded.push(polyToTex([termMul(a, b)]));
        let expTex = cleanSigns(expanded.join(" + "));
        
        explanation.push(`$$ ${qTex} = ${expTex} $$`);
        explanation.push(`$$ = ${polyToTex(ansObj)} $$`);
      }
    } else if (realOp === 'div') {
      let D, Q, R, N;
      let loopGuard = 0;
      do {
        loopGuard++;
        let isLinearD = Math.random() < 0.8;
        let degD = isLinearD ? 1 : 2;
        let isMonoD = Math.random() < 0.4;
        D = [];
        if (isMonoD) {
          D.push(genTerm(vars, degD, degD+1, 3, false, degD));
        } else {
          D.push(genTerm(vars, degD, degD, 1, false, degD));
          for (let i = degD - 1; i >= 0; i--) {
            if (Math.random() < 0.6) D.push(genTerm(vars, i, i+1, 3, false, i));
          }
        }
        if (vars >= 1 && D[0]) D[0].x = Math.max(1, D[0].x || 0);
        D = simplify(D).slice(0, 3);
        
        let degQ = Math.random() < 0.8 ? 1 : 2;
        Q = [];
        Q.push(genTerm(vars, degQ, degQ+1, 3, false, degQ));
        for (let i = degQ - 1; i >= 0; i--) {
          if (Math.random() < 0.6) Q.push(genTerm(vars, i, i+1, 3, false, i));
        }
        Q = simplify(Q).slice(0, 3);
        
        R = [];
        // 割り切れる問題（R=[]）も出題されるように確率調整
        if (!isMonoD && degD > 0 && Math.random() < 0.5) {
          let degR = randInt(0, degD - 1);
          R.push(genTerm(vars, degR, degR+1, 3, false, degR));
          for (let i = degR - 1; i >= 0; i--) {
            if (Math.random() < 0.5) R.push(genTerm(vars, i, i+1, 3, false, i));
          }
          R = simplify(R).slice(0, 2);
        }
        
        let DQ = polyMul(D, Q);
        N = polyAdd(DQ, R);
      } while ((N.length < 2 || N.length > 3 || D.length > 3 || D.length === 0) && loopGuard < 50);
      
      if (N.length > 3) N = N.slice(0, 3);
      if (D.length === 0) D = [{c:1, x:0, y:0, z:0}];
      
      ansObj = { Q, R, N, D };
      let isMonoD = D.length === 1;
      let isDivisible = R.length === 0;
      
      let nt = parensIfPolyOrNeg(N);
      let dt = parensIfPolyOrNeg(D);
      qTex = `${nt} \\div ${dt}`;
      
      explanation.push(`整式の割り算は、筆算で行うことができます。`);
      stepsDiv = { N, D, Q, R };
      
      if (isMonoD && isDivisible) {
        stepsDiv.hasAlt = true;
        stepsDiv.altExplanation = [
          `割る式が単項式で割り切れる場合は、分数の形にして約分することもできます。`,
          `$$ ${qTex} = \\dfrac{${polyToTex(N)}}{${polyToTex(D)}} $$`
        ];
        let commonTex = polyToTex(D);
        let qTexInParens = parens(polyToTex(Q));
        stepsDiv.altExplanation.push(`分子を共通因数 $${commonTex}$ でくくります。`);
        stepsDiv.altExplanation.push(`$$ = \\dfrac{${commonTex}${qTexInParens}}{${commonTex}} $$`);
        stepsDiv.altExplanation.push(`分母と分子の $${commonTex}$ を約分します。`);
        stepsDiv.altExplanation.push(`$$ = ${polyToTex(Q)} $$`);
      }
    }
  }
  
  let distractors = [];
  let guard = 0;
  while(distractors.length < 2 && guard < 60) {
    guard++;
    let dist = createDistractor(type, realOp, ansObj, guard, vars);
    let key = ansKey(type, realOp, dist);
    let correctKey = ansKey(type, realOp, ansObj);
    if (key !== correctKey && !distractors.some(d => ansKey(type, realOp, d) === key)) {
      distractors.push(dist);
    }
  }
  
  let options = shuffle([ansObj, distractors[0], distractors[1]]);
  let correctIndex = options.findIndex(o => ansKey(type, realOp, o) === ansKey(type, realOp, ansObj));
  
  return { qTex, ansObj, options, correctIndex, explanation, stepsDiv, isMul, hasDot };
}

function createDistractor(type, realOp, ansObj, step, vars) {
  if (type === 'num') {
    if (realOp === 'mul') {
      if (step % 2 === 0) return ansObj > 0 ? -ansObj : (ansObj === 0 ? pick([2, -2]) : Math.abs(ansObj));
      else return ansObj + pick([1, -1, 2, -2]) * pick([1, 2, 3]); 
    }
    return ansObj + pick([1, -1, 2, -2, 10, -10]);
  }
  if (realOp === 'div' && type === 'poly') {
    let modQ = clonePoly(ansObj.Q); let modR = clonePoly(ansObj.R);
    if(Math.random()<0.5 && modQ.length > 0) modQ[0].c = -modQ[0].c;
    else if(modR.length > 0) modR[0].c += pick([1, -1]);
    else modQ.push({c: pick([1, -1]), x:0, y:0, z:0});
    return { Q: simplify(modQ), R: simplify(modR) };
  }
  if (realOp === 'div' && type === 'mono') {
    let A2 = cloneTerm(ansObj.A); let B2 = cloneTerm(ansObj.B);
    if (step % 3 === 0) A2.c = -A2.c; 
    else if (step % 3 === 1) { let t=A2.x; A2.x=B2.x; B2.x=t; }
    else A2.x = Math.max(0, A2.x + pick([1, -1])); 
    return { A: A2, B: B2 };
  }
  if (realOp === 'mul' && type === 'mono') {
    let cVal = ansObj.length > 0 ? ansObj[0].c : 1;
    let dx = ansObj.length > 0 ? ansObj[0].x : 0;
    let dy = ansObj.length > 0 ? ansObj[0].y : 0;
    let dz = ansObj.length > 0 ? ansObj[0].z : 0;
    
    let target = pick(vars === 1 ? ['x'] : vars === 2 ? ['x', 'y'] : ['x', 'y', 'z']);
    if (target === 'x') dx = Math.max(0, dx + pick([1, -1]));
    else if (target === 'y') dy = Math.max(0, dy + pick([1, -1]));
    else dz = Math.max(0, dz + pick([1, -1]));

    if (dx === (ansObj[0]?ansObj[0].x:0) && dy === (ansObj[0]?ansObj[0].y:0) && dz === (ansObj[0]?ansObj[0].z:0)) {
      if (vars >= 2 && Math.random() < 0.5) dy += 1;
      else dx += 1;
    }
    return simplify([{ c: cVal, x: dx, y: dy, z: dz }]);
  }
  
  let modP = clonePoly(ansObj);
  if (modP.length === 0) {
    modP = [{c: pick([1, 2]), x:0, y:0, z:0}];
  } else {
    let idx = randInt(0, modP.length - 1);
    if (step % 2 === 0) modP[idx].c = -modP[idx].c;
    else modP[idx].c += pick([1, -1, 2]);
  }
  return simplify(modP);
}

function clonePoly(P) { return P.map(t => cloneTerm(t)); }

/* ========== HTML Hissan Renderer ========== */

function formatTermXLast(t, isFirst, forceSign = false) {
  if (t.c === 0) return "";
  let absC = Math.abs(t.c);
  let varsExist = t.x > 0 || t.y > 0 || t.z > 0;
  let cStr = (absC === 1 && varsExist) ? "" : absC.toString();
  let sign = t.c < 0 ? "-" : ((isFirst && !forceSign) ? "" : "+");
    if (sign !== "" && (!isFirst || forceSign)) {
    sign += "\\;";
  }
  let xStr = t.x === 0 ? "" : (t.x === 1 ? "x" : `x^{${t.x}}`);
  let yStr = t.y === 0 ? "" : (t.y === 1 ? "y" : `y^{${t.y}}`);
  let zStr = t.z === 0 ? "" : (t.z === 1 ? "z" : `z^{${t.z}}`);
  
  let vars = yStr + zStr + xStr;
  let body = cStr + vars;
  if (body === "") body = "1";
  return sign + body;
}

function polyToTexXLast(poly) {
  if (poly.length === 0) return "0";
  let tex = "";
  for (let i = 0; i < poly.length; i++) tex += formatTermXLast(poly[i], i === 0);
  return tex;
}

function buildHissanHtml(N, D, Q, R) {
  let maxDeg = degX(N);
  if (maxDeg < 0) maxDeg = 0;
  
  function getTerm(poly, d) { return poly.find(t => t.x === d) || { c: 0, x: d, y: 0, z: 0 }; }
  function isHighest(poly, d) { return !poly.some(t => t.x > d && t.c !== 0); }
  
  let html = `<div class="hissan-table-container"><table class="hissan-table"><tbody>`;
  
  // Q
  let qTerms = [];
  for(let d = maxDeg; d >= 0; d--) {
    let t = getTerm(Q, d);
    if (t.c !== 0) {
      qTerms.push(formatTermXLast(t, qTerms.length === 0));
    }
  }

  html += `<tr><td></td>`;
  for(let i = 0; i <= maxDeg; i++) {
    let tex = qTerms[i] || "";
    html += `<td class="hissan-border-bottom">${tex ? renderKatex(tex) : ""}</td>`;
  }
  html += `</tr>`;
  
  // N & D
  let nCells = [];
  for(let d = maxDeg; d >= 0; d--) {
    let t = getTerm(N, d);
    nCells.push(t.c !== 0 ? formatTermXLast(t, isHighest(N, d), true) : "");
  }
  let firstN = nCells.findIndex(c => c !== "");
  if (firstN !== -1) nCells[firstN] = nCells[firstN].replace(/^\+/, '');
  
  html += `<tr>`;
  html += `<td class="hissan-divisor">${renderKatex(polyToTexXLast(D))}<span class="paren-divisor">)</span></td>`;
  nCells.forEach(c => html += `<td>${c ? renderKatex(c) : ""}</td>`);
  html += `</tr>`;
  
  let curN = clonePoly(N);
  for(let qi = 0; qi < Q.length; qi++) {
    let qTerm = Q[qi];
    let subP = polyMul(D, [qTerm]);
    let subCells = [];
    for(let d = maxDeg; d >= 0; d--) {
      let t = getTerm(subP, d);
      subCells.push(t.c !== 0 ? formatTermXLast(t, isHighest(subP, d), true) : "");
    }
    let firstSub = subCells.findIndex(c => c !== "");
    if (firstSub !== -1) subCells[firstSub] = subCells[firstSub].replace(/^\+/, '');
    
    let startColIdx = maxDeg - Math.max(degX(curN), degX(subP));
    
    html += `<tr><td></td>`;
    subCells.forEach((c, idx) => {
      let cls = idx >= startColIdx ? "hissan-border-bottom" : "";
      html += `<td class="${cls}">${c ? renderKatex(c) : ""}</td>`;
    });
    html += `</tr>`;
    
    curN = polySub(curN, subP);
    
    if (qi < Q.length - 1 || curN.length > 0) {
      let nextCells = [];
      if (curN.length === 0) {
        for(let d = maxDeg; d >= 0; d--) nextCells.push(d === 0 ? "0" : "");
      } else {
        for(let d = maxDeg; d >= 0; d--) {
          let t = getTerm(curN, d);
          nextCells.push(t.c !== 0 ? formatTermXLast(t, isHighest(curN, d), true) : "");
        }
        let firstNext = nextCells.findIndex(c => c !== "");
        if (firstNext !== -1) nextCells[firstNext] = nextCells[firstNext].replace(/^\+/, '');
      }
      html += `<tr><td></td>`;
      nextCells.forEach(c => html += `<td>${c ? renderKatex(c) : ""}</td>`);
      html += `</tr>`;
    } else {
      html += `<tr><td></td>`;
      for(let d = maxDeg; d >= 0; d--) {
        html += `<td>${d === 0 ? renderKatex("0") : ""}</td>`;
      }
      html += `</tr>`;
    }
  }
  
  html += `</tbody></table></div>`;
  return html;
}

/* ========== Render ========== */
function applyModeUI() {
  typeMenu.querySelectorAll('.chip').forEach(btn => {
    const active = btn.dataset.type === currentType;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  
  opMenu.querySelectorAll('.chip').forEach(btn => {
    const active = btn.dataset.op === currentOp;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const varChips = varMenu.querySelectorAll('.chip');
  if (currentType === 'num' || currentType === 'poly') {
    // num と poly は文字数2,3をグレーアウトして選択不可に（問題は文字1個固定）
    varChips.forEach(btn => {
      if (btn.dataset.var === '1') {
        btn.disabled = false;
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        currentVars = 1;
      } else {
        btn.disabled = true;
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });
  } else {
    varChips.forEach(btn => {
      btn.disabled = false;
      const active = parseInt(btn.dataset.var) === currentVars;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
}

function renderQuestion(prob) {
  questionArea.innerHTML = '';
  const layout = document.createElement('div');
  layout.className = 'one-pane-layout';
  
  let mulAnnotation = (prob.hasDot && currentType !== 'num') ? 
    `<div class="annotation">※「${renderKatex('\\cdot')}」は「${renderKatex('\\times')}」と同じ意味です。</div>` : "";
  
  layout.innerHTML = `
    <div class="question-header">
      <p class="question-prompt">${TXT.prompt}</p>
      <div class="formula-display">
        ${renderKatex(prob.qTex, true)}
        ${mulAnnotation}
      </div>
    </div>
    <div class="choices" id="choicesGroup"></div>
    <div id="nextBtnContainer" style="display: none; margin-top: 16px; text-align: center;">
      <button type="button" class="btn-next next-btn-main">${TXT.nextBtn}</button>
    </div>
  `;
  questionArea.appendChild(layout);

  const choicesGroup = document.getElementById('choicesGroup');
  prob.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn';
    btn.dataset.index = String(i);
    btn.innerHTML = `
      <span class="choice-letter">${String.fromCharCode(65 + i)}</span>
      <span class="choice-content">
        ${renderKatex(ansToTex(currentType, currentOp === 'addsub' ? 'add' : currentOp, opt))}
      </span>
      <span class="choice-badge"></span>
    `;
    choicesGroup.appendChild(btn);
  });
}

function clearFeedback() {
  explanationEl.hidden = true;
  explanationEl.innerHTML = '';
}

function newProblem() {
  locked = false;
  clearFeedback();
  currentProblem = makeProblem();
  renderQuestion(currentProblem);
}

function updateScoreboard() {
  correctCountEl.textContent = correctCount;
  wrongCountEl.textContent = wrongCount;
  streakCountEl.textContent = streak;
}

function selectChoice(index) {
  if (locked || !currentProblem) return;
  locked = true;

  const { correctIndex, explanation, ansObj, stepsDiv } = currentProblem;
  const buttons = questionArea.querySelectorAll('.choice-btn');
  const isCorrect = index === correctIndex;

  buttons.forEach(btn => {
    btn.disabled = true;
    const iNum = Number(btn.dataset.index);
    const badge = btn.querySelector('.choice-badge');
    if (iNum === correctIndex) {
      btn.classList.add('is-correct');
      if (badge) badge.textContent = TXT.correct;
    } else if (iNum === index && !isCorrect) {
      btn.classList.add('is-wrong');
      if (badge) badge.textContent = TXT.incorrect;
    } else {
      btn.classList.add('is-dimmed');
    }
  });

  if (isCorrect) { correctCount++; streak++; } 
  else { wrongCount++; streak = 0; }
  
  updateScoreboard();

  const resultClass = isCorrect ? 'correct' : 'wrong';
  const choiceChar = String.fromCharCode(65 + correctIndex);
  
  let resultTitle = isCorrect 
    ? `${TXT.ansTitleCorrect} &nbsp;&rarr;&nbsp; <span class="math-ans">${TXT.choiceLabel} ${choiceChar}</span>`
    : `${TXT.ansTitleWrong} &nbsp; <span class="math-ans">${TXT.choiceLabel} ${choiceChar}</span>`;
  
  let correctTexStr = ansToTex(currentType, currentOp === 'addsub' ? 'add' : currentOp, ansObj);
  let ansText = `${TXT.ansLabel} &nbsp; <span class="math-ans">${renderKatex(correctTexStr)}</span>`;
  
  const parseTeX = (text) => text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => renderKatex(tex.trim(), true))
                                 .replace(/\$([^$]+)\$/g, (_, tex) => renderKatex(tex.trim(), false));

  const explLis = explanation.map(text => `
    <li><div class="exp-li-ja">${parseTeX(text)}</div></li>
  `).join('');
  
  let hissanHtml = stepsDiv ? buildHissanHtml(stepsDiv.N, stepsDiv.D, stepsDiv.Q, stepsDiv.R) : "";

  let altHtml = "";
  if (stepsDiv && stepsDiv.hasAlt && stepsDiv.altExplanation) {
    const altLis = stepsDiv.altExplanation.map(text => `
      <li><div class="exp-li-ja">${parseTeX(text)}</div></li>
    `).join('');
    altHtml = `<div class="exp-expl-label" style="margin-top: 24px;">【別解】</div>
               <ul class="exp-list">${altLis}</ul>`;
  }

  explanationEl.innerHTML = `
    <div class="exp-box ${resultClass}">
      <div class="exp-header">
        <h3 class="exp-title">${resultTitle}</h3>
      </div>
      <div class="exp-body">
        <div class="exp-ans-line">${ansText}</div>
        <div class="exp-expl-label">${TXT.explLabel}</div>
        <ul class="exp-list">
          ${explLis}
        </ul>
        ${hissanHtml}
        ${altHtml}
        <div style="text-align: center; margin-top: 24px;">
          <button type="button" class="btn-next next-btn-exp">${TXT.nextBtn}</button>
        </div>
      </div>
    </div>
  `;
  explanationEl.hidden = false;

  setTimeout(() => {
    const container = document.getElementById('nextBtnContainer');
    if (container) {
      container.style.display = 'block';
      const nextBtn = container.querySelector('.next-btn-main');
      if (nextBtn) nextBtn.focus({ preventScroll: true });
    }
  }, 100);
}

/* ========== Events ========== */
typeMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn || btn.disabled) return;
  currentType = btn.dataset.type;
  applyModeUI(); newProblem();
});
opMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn || btn.disabled) return;
  currentOp = btn.dataset.op;
  applyModeUI(); newProblem();
});
varMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn || btn.disabled) return;
  currentVars = parseInt(btn.dataset.var);
  applyModeUI(); newProblem();
});
questionArea.addEventListener('click', (e) => {
  if (e.target.closest('.btn-next')) { newProblem(); return; }
  const btn = e.target.closest('.choice-btn');
  if (!btn || btn.disabled || locked) return;
  selectChoice(Number(btn.dataset.index));
});
explanationEl.addEventListener('click', (e) => {
  if (e.target.closest('.btn-next')) newProblem();
});
resetBtn.addEventListener('click', () => {
  correctCount = 0; wrongCount = 0; streak = 0;
  updateScoreboard(); newProblem();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && locked) {
    const nextBtnMain = document.querySelector('#nextBtnContainer .next-btn-main');
    if (nextBtnMain) { e.preventDefault(); nextBtnMain.click(); return; }
    const nextBtnExp = explanationEl.querySelector('.next-btn-exp');
    if (nextBtnExp) { e.preventDefault(); nextBtnExp.click(); return; }
  }
  if (locked) return;
  const map = { '1': 0, '2': 1, '3': 2, a: 0, b: 1, c: 2, A: 0, B: 1, C: 2 };
  if (e.key in map) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault(); selectChoice(map[e.key]);
  }
});

/* ========== Init ========== */
function init() {
  applyModeUI();
  updateScoreboard();
  newProblem();
}

if (typeof katex !== 'undefined') {
  init();
} else {
  window.addEventListener('load', init);
  setTimeout(() => { if (!currentProblem) init(); }, 300);
}
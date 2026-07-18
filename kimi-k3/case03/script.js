'use strict';

// ---------- Expression evaluation (correct operator precedence) ----------

var OPERATORS = { '+': 1, '−': 1, '×': 2, '÷': 2 };

function tokenize(expr) {
  var tokens = [];
  var i = 0;
  while (i < expr.length) {
    var ch = expr[i];
    if (/[0-9.]/.test(ch)) {
      var num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push(parseFloat(num));
    } else {
      tokens.push(ch);
      i++;
    }
  }
  return tokens;
}

// Shunting-yard: convert infix tokens to RPN, then evaluate.
function evaluateExpression(expr) {
  if (expr.charAt(0) === '−') expr = '0' + expr; // leading minus
  while (expr.length && OPERATORS[expr.charAt(expr.length - 1)]) {
    expr = expr.slice(0, -1); // ignore trailing operators
  }
  if (!expr) return 0;

  var tokens = tokenize(expr);
  var output = [];
  var ops = [];
  var i, t;

  for (i = 0; i < tokens.length; i++) {
    t = tokens[i];
    if (typeof t === 'number') {
      output.push(t);
    } else {
      while (ops.length && OPERATORS[ops[ops.length - 1]] >= OPERATORS[t]) {
        output.push(ops.pop());
      }
      ops.push(t);
    }
  }
  while (ops.length) output.push(ops.pop());

  var stack = [];
  for (i = 0; i < output.length; i++) {
    t = output[i];
    if (typeof t === 'number') {
      stack.push(t);
    } else {
      var b = stack.pop();
      var a = stack.pop();
      if (t === '+') stack.push(a + b);
      else if (t === '−') stack.push(a - b);
      else if (t === '×') stack.push(a * b);
      else if (t === '÷') {
        if (b === 0) return 'Error';
        stack.push(a / b);
      }
    }
  }

  var result = stack[0];
  if (typeof result !== 'number' || !isFinite(result)) return 'Error';
  return Number(result.toPrecision(12)); // tame floating point noise
}

// ---------- Calculator UI ----------

if (typeof document !== 'undefined') {
  var display = document.getElementById('display');
  var current = '0';
  var justEvaluated = false;

  function render() {
    display.textContent = current;
  }

  function currentNumberHasDot() {
    var lastOp = Math.max(
      current.lastIndexOf('+'),
      current.lastIndexOf('−'),
      current.lastIndexOf('×'),
      current.lastIndexOf('÷')
    );
    return current.indexOf('.', lastOp + 1) !== -1;
  }

  function pressDigit(d) {
    if (justEvaluated || current === 'Error') {
      current = '0';
      justEvaluated = false;
    }
    if (current === '0') current = d;
    else current += d;
    render();
  }

  function pressDot() {
    if (justEvaluated || current === 'Error') {
      current = '0';
      justEvaluated = false;
    }
    if (!currentNumberHasDot()) current += '.';
    render();
  }

  function pressOperator(op) {
    if (current === 'Error') return;
    justEvaluated = false;
    var last = current.charAt(current.length - 1);
    if (OPERATORS[last]) {
      current = current.slice(0, -1) + op; // replace previous operator
    } else if (current === '0' || current === '') {
      if (op === '−') current = '−'; // allow leading minus
    } else {
      current += op;
    }
    render();
  }

  function pressClear() {
    current = '0';
    justEvaluated = false;
    render();
  }

  function pressEquals() {
    if (current === 'Error') return;
    current = String(evaluateExpression(current));
    justEvaluated = true;
    render();
  }

  document.querySelectorAll('.key').forEach(function (key) {
    key.addEventListener('click', function () {
      if (key.dataset.digit !== undefined) pressDigit(key.dataset.digit);
      else if (key.dataset.op) pressOperator(key.dataset.op);
      else if (key.dataset.action === 'clear') pressClear();
      else if (key.dataset.action === 'dot') pressDot();
      else if (key.dataset.action === 'equals') pressEquals();
    });
  });

  render();
}

// Allow Node-based testing of the evaluator.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { evaluateExpression: evaluateExpression };
}

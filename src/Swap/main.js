/** Local simulation environment code; Do not modify */
const neblocal = require('../../lib/neblocal')
const crypto = require('../../lib/crypto')
const BigNumber = require('bignumber.js')
const Blockchain = neblocal.Blockchain
const LocalContractStorage = neblocal.LocalContractStorage
const Event = neblocal.Event
/** Local simulation environment code; End. */

/*

# pair
pairName => {
  createdTime: now,
  token0: token0,
  token1: token1,
  reserve0: "0",
  reserve1: "0",
  blockTimestampLast: 0,
  price0CumulativeLast: "0",
  price1CumulativeLast: "0",
  lp: lp
}

*/

const MINIMUM_LIQUIDITY = 1000;
const UNIT_LIQUIDITY = 1;

var Swap = function () {

    this.__contractName = 'Swap';

  LocalContractStorage.defineProperties(this, {
    _owner: null,
    _wnas: null,
    _allPairs: {
      stringify: function (array) {
        return JSON.stringify(array);
      },
      parse: function (value) {
        return JSON.parse(value);
      }
    }
  });

  // pairName
  LocalContractStorage.defineMapProperty(this, "pairInfo", {
    stringify: function (obj) {
      return JSON.stringify({
        createdTime: obj.createdTime,
        token0: obj.token0,
        token1: obj.token1,
        reserve0: obj.reserve0.toString(10),
        reserve1: obj.reserve1.toString(10),
        blockTimestampLast: obj.blockTimestampLast,
        price0CumulativeLast: obj.price0CumulativeLast.toString(), 
        price1CumulativeLast: obj.price1CumulativeLast.toString(), 
        lp: obj.lp
      });
    },
    parse: function (str) {
      const obj = JSON.parse(str || "null");

      if (!obj) return null;

      return {
        createdTime: obj.createdTime,
        token0: obj.token0,
        token1: obj.token1,
        reserve0: new BigNumber(obj.reserve0),
        reserve1: new BigNumber(obj.reserve1),
        blockTimestampLast: obj.blockTimestampLast,
        price0CumulativeLast: new BigNumber(obj.price0CumulativeLast),
        price1CumulativeLast: new BigNumber(obj.price1CumulativeLast),
        lp: obj.lp
      }
    }
  });
};


Swap.prototype = {

  init(wnas) {
    this._wnas = wnas;
    this._owner = Blockchain.transaction.from;
    this._allPairs = [];
  },

  _verifyPermission: function () {
    if (Blockchain.transaction.from != this._owner) {
        throw new Error("only owner has permission.");
    }
},

  _verifyAddress: function (address) {
    if (Blockchain.verifyAddress(address) === 0) {
        throw new Error("Address format error, address=" + address);
    }
  },

  _verifyValue: function(value) {
      let bigVal = new BigNumber(value);
      if (bigVal.isNaN() || !bigVal.isFinite()) {
          throw new Error("Invalid value, value=" + value);
      }
      if (bigVal.isNegative()) {
          throw new Error("Value is negative, value=" + value);
      }
      if (!bigVal.isInteger()) {
          throw new Error("Value is not integer, value=" + value);
      }
      if (value !== bigVal.toString(10)) {
          throw new Error("Invalid value format.");
      }
  },


  _setPair: function (pairName, pair) {
    this.pairInfo.set(pairName, pair);
  },

  _setPairObj: function (pair) {
    const pairName = pair.token0 + "/" + pair.token1;
    this._setPair(pairName, pair);
  },

  _getPair: function (pairName) {
    return this.pairInfo.get(pairName);
  },

  _insertToAllPairs: function (pairName) {
    this._allPairs = this._allPairs.concat(pairName);
  },

  _getPairName: function (token0, token1) {
    let pairName;
    if (token0 < token1) {
      pairName = token0 + "/" + token1;
    } else {
      pairName = token1 + "/" + token0;
    }
    return pairName;
  },

  getPair: function (token0, token1) {
    this._verifyAddress(token0);
    this._verifyAddress(token1);

    const pairName = this._getPairName(token0, token1);
    return this._getPair(pairName);
  },

  getPairByLp: function(lp) {
    let pairs = this.allPairs();
    for (let pairName of pairs) {
      let pair = this._getPair(pairName);
      if (pair.lp == lp) {
        return pair;
      }
    }
    throw new Error('pair not found.')
  },

  allPairs: function () {
    return this._allPairs;
  },

  createPair: function (token0, token1, lp) {
    this._verifyPermission();
    this._verifyAddress(token0);
    this._verifyAddress(token1);
    this._verifyAddress(token0);
    this._verifyAddress(lp);

    if (token0 > token1) {
      let temp = token0;
      token0 = token1;
      token1 = temp;
    }

    const pairName = this._getPairName(token0, token1);

    if (this._getPair(pairName)) {
      throw "pair exists";
    }

    const now = Blockchain.transaction.timestamp;

    this.pairInfo.set(pairName, {
      createdTime: now,
      token0: token0,
      token1: token1,
      reserve0: new BigNumber(0),
      reserve1: new BigNumber(0),
      blockTimestampLast: 0,
      price0CumulativeLast: new BigNumber(0),
      price1CumulativeLast: new BigNumber(0),
      lp: lp
    });

    this._insertToAllPairs(pairName);
  },

  // update reserves and, on the first call per block, price accumulators
  _update: function (pair, balance0, balance1) {
    const now = Blockchain.transaction.timestamp;

    if (now < pair.blockTimestampLast) {
      throw "block time error";
    }

    const timeElapsed = now - pair.blockTimestampLast;

    if (timeElapsed > 0 && pair.reserve0 > 0 && pair.reserve1 > 0) {
      pair.price0CumulativeLast =
          new BigNumber(pair.price0CumulativeLast.plus(
              pair.reserve1.div(
                  pair.reserve0).times(timeElapsed)).toFixed(0, BigNumber.ROUND_DOWN));
      pair.price1CumulativeLast =
          new BigNumber(pair.price1CumulativeLast.plus(
              pair.reserve0.div(
                  pair.reserve1).times(timeElapsed)).toFixed(0, BigNumber.ROUND_DOWN));
    }

    pair.reserve0 = balance0;
    pair.reserve1 = balance1;
    pair.blockTimestampLast = now;

    this._setPairObj(pair);

    Event.Trigger("sync", {
      Sync: {
        balance0: balance0.toString(),
        balance1: balance1.toString()
      }
    });
  },

  _mint: function (lp, toAddress, amount) {
    var lpContract = new Blockchain.Contract(lp);
    lpContract.call("mint", toAddress, amount.toString());
  },

  _burn: function (lp, fromAddress, amount) {
    var lpContract = new Blockchain.Contract(lp);
    lpContract.call("burnFrom", fromAddress, amount.toString());
  },

  _mintInner: function (tokenA, tokenB, amountA, amountB, toAddress, alreadyHasWNAS) {
    const pair = this.getPair(tokenA, tokenB);

    const amount0 = new BigNumber(pair.token0 == tokenA ? amountA : amountB);
    const amount1 = new BigNumber(pair.token1 == tokenB ? amountB : amountA);

    if (amount0.lte(0) || amount1.lte(0)) {
      throw "Swap: INVALID_INPUT";
    }

    if (pair.token0 != this._wnas || !alreadyHasWNAS) {
      var token0Contract = new Blockchain.Contract(pair.token0);
      token0Contract.call("transferFrom",
          Blockchain.transaction.from,
          Blockchain.transaction.to,
          amount0.toString());
    }

    if (pair.token1 != this._wnas || !alreadyHasWNAS) {
      var token1Contract = new Blockchain.Contract(pair.token1);
      token1Contract.call("transferFrom",
          Blockchain.transaction.from,
          Blockchain.transaction.to,
          amount1.toString());
    }

    var lpContract = new Blockchain.Contract(pair.lp);
    const _totalSupply = new BigNumber(lpContract.call("totalSupply"));

    let liquidity;

    if (_totalSupply.eq(0)) {
      liquidity = amount0.times(amount1).sqrt().minus(MINIMUM_LIQUIDITY);
      this._mint(pair.lp, Blockchain.transaction.to, MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
    } else {
      liquidity = BigNumber.min(amount0.times(_totalSupply).div(pair.reserve0),
          amount1.times(_totalSupply).div(pair.reserve1));
    }

    liquidity = new BigNumber(liquidity.toFixed(0, BigNumber.ROUND_DOWN))

    const balance0 = amount0.plus(pair.reserve0);
    const balance1 = amount1.plus(pair.reserve1);

    if (liquidity.lt(UNIT_LIQUIDITY)) {
      throw 'Swap: INSUFFICIENT_LIQUIDITY_MINTED';
    }

    this._mint(pair.lp, toAddress, liquidity);

    this._update(pair, balance0, balance1);

    return liquidity;
  },

  _burnInner: function (tokenA, tokenB, liquidity, toAddress) {
    if (liquidity.lt(UNIT_LIQUIDITY)) {
      throw "Swap: INVALID_INPUT";
    }

    const pair = this.getPair(tokenA, tokenB);

    // gas savings, must be defined here since totalSupply can update in _mintFee
    var lpContract = new Blockchain.Contract(pair.lp);
    const _totalSupply = new BigNumber(lpContract.call("totalSupply"));

    const amount0 = new BigNumber(liquidity.times(pair.reserve0).div(_totalSupply).toFixed(0, BigNumber.ROUND_DOWN)); // using balances ensures pro-rata distribution
    const amount1 = new BigNumber(liquidity.times(pair.reserve1).div(_totalSupply).toFixed(0, BigNumber.ROUND_DOWN)); // using balances ensures pro-rata distribution

    if (amount0.lte(0) || amount1.lte(0)) {
      throw 'Swap: INSUFFICIENT_LIQUIDITY_BURNED';
    }

    this._burn(pair.lp, Blockchain.transaction.from, liquidity);

    let wnas = this._wnas;
    var token0Contract = new Blockchain.Contract(pair.token0);
    if (pair.token0 === wnas) {
      token0Contract.call("withdraw", amount0.toString(10));
      Blockchain.transfer(toAddress, amount0.toString(10));
    } else {
      token0Contract.call("transfer", Blockchain.transaction.from, amount0.toString(10));
    }

    var token1Contract = new Blockchain.Contract(pair.token1);
    if (pair.token1 === wnas) {
      token1Contract.call("withdraw", amount1.toString(10));
      Blockchain.transfer(toAddress, amount1.toString(10));
    } else {
      token1Contract.call("transfer", Blockchain.transaction.from, amount1.toString(10));
    }

    const balance0 = pair.reserve0.minus(amount0);
    const balance1 = pair.reserve1.minus(amount1);

    this._update(pair, balance0, balance1);

    if (tokenA == pair.token0) {
      return [amount0, amount1];
    } else {
      return [amount1, amount0];
    }
  },

  _swapInner: function (tokenA, tokenB, amountAIn, amountBIn, amountAOut, amountBOut, srcAddress, dstAddress) {
    const pair = this.getPair(tokenA, tokenB);

    const amount0In = new BigNumber(pair.token0 == tokenA ? amountAIn : amountBIn);
    const amount1In = new BigNumber(pair.token1 == tokenB ? amountBIn : amountAIn);
    const amount0Out = new BigNumber(pair.token0 == tokenA ? amountAOut : amountBOut);
    const amount1Out = new BigNumber(pair.token1 == tokenB ? amountBOut : amountAOut);

    if (amount0In.lt(0) || amount1In.lt(0) || amount0Out.lt(0) || amount1Out.lt(0)) {
      throw "Swap: INVALID_INPUT";
    }

    if (amount0Out.eq(0) && amount1Out.eq(0)) {
      throw "Swap: INSUFFICIENT_OUTPUT_AMOUNT";
    }

    if (amount0In.eq(0) && amount1In.eq(0)) {
      throw "Swap: INSUFFICIENT_INPUT_AMOUNT";
    }

    if (amount0Out.gte(pair.reserve0) || amount1Out.gte(pair.reserve1)) {
      throw "Swap: INSUFFICIENT_LIQUIDITY";
    }

    if (amount0In.gt(0) && srcAddress != Blockchain.transaction.to) {
      // optimistically transfer tokens in
      var token0Contract = new Blockchain.Contract(pair.token0);
      token0Contract.call("transferFrom",
          srcAddress,
          Blockchain.transaction.to,
          amount0In.toString());
    }

    if (amount1In.gt(0) && srcAddress != Blockchain.transaction.to) {
      // optimistically transfer tokens in
      var token1Contract = new Blockchain.Contract(pair.token1);
      token1Contract.call("transferFrom",
          srcAddress,
          Blockchain.transaction.to,
          amount1In.toString());
    }

    if (amount0Out.gt(0) && dstAddress != Blockchain.transaction.to) {
      // optimistically transfer tokens out
      var token0Contract = new Blockchain.Contract(pair.token0);
      token0Contract.call("transfer",
          dstAddress,
          amount0Out.toString());
    }

    if (amount1Out.gt(0) && dstAddress != Blockchain.transaction.to) {
      // optimistically transfer tokens out
      var token1Contract = new Blockchain.Contract(pair.token1);
      token1Contract.call("transfer",
          dstAddress,
          amount1Out.toString());
    }

    const balance0 = pair.reserve0.plus(amount0In).minus(amount0Out);
    const balance1 = pair.reserve1.plus(amount1In).minus(amount1Out);

    const balance0Adjusted = balance0.times(1000).minus(amount0In.times(3));
    const balance1Adjusted = balance1.times(1000).minus(amount1In.times(3));

    if (balance0Adjusted.times(balance1Adjusted).lt(pair.reserve0.times(pair.reserve1).times(1000000))) {
      throw "Swap: K";
    }

    this._update(pair, balance0, balance1);
  },

  _quote: function (amountADesired, reserveA, reserveB) {
    amountADesired = new BigNumber(amountADesired);
    reserveA = new BigNumber(reserveA);
    reserveB = new BigNumber(reserveB);

    if (amountADesired.lt(0) || reserveA.lte(0) || reserveB.lt(0)) {
      throw "Swap: INVALID_INPUT";
    }

    return new BigNumber(amountADesired.times(reserveB).div(reserveA).toFixed(0, BigNumber.ROUND_DOWN));
  },

  quote: function (amountADesired, reserveA, reserveB) {
    return this._quote(amountADesired, reserveA, reserveB).toString();
  },

  _addLiquidity: function (tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin) {
    const pair = this.getPair(tokenA, tokenB);

    if (!pair) {
      throw "pair not existing";
    }

    let reserveA;
    let reserveB; 
    if (tokenA == pair.token0) {
      reserveA = pair.reserve0;
      reserveB = pair.reserve1;
    } else {
      reserveA = pair.reserve1;
      reserveB = pair.reserve0;
    }

    if (reserveA.eq(0) && reserveB.eq(0)) {
      return [amountADesired.toString(10), amountBDesired.toString(10)];
    } else {
      const amountBOptimal = this._quote(amountADesired, reserveA, reserveB);
      if (amountBOptimal.lte(amountBDesired)) {
        if (amountBOptimal.lt(amountBMin)) {
          throw "insufficient b amount";
        }

        return [amountADesired.toString(), amountBOptimal.toString()];
      } else {
        const amountAOptimal = this._quote(amountBDesired, reserveB, reserveA);

        if (amountAOptimal.gt(amountADesired)) {
          throw "something went wrong";
        }

        if (amountAOptimal.lt(amountAMin)) {
          throw "insufficient a amount";
        }

        return [amountAOptimal.toString(10), amountBDesired.toString(10)];
      }
    }
  },

  addLiquidity: function (tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, toAddress) {
    this._verifyAddress(tokenA);
    this._verifyAddress(tokenB);
    this._verifyAddress(toAddress);

    amountADesired = new BigNumber(amountADesired);
    amountBDesired = new BigNumber(amountBDesired);
    amountAMin = new BigNumber(amountAMin);
    amountBMin = new BigNumber(amountBMin);

    if (amountADesired.lte(0) || amountBDesired.lte(0) || amountAMin.lte(0) || amountBMin.lte(0)) {
      throw "Swap: INVALID_INPUT";
    }

    const amountArray = this._addLiquidity(
        tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
    const amountAStr = amountArray[0];
    const amountBStr = amountArray[1];
    const liquidity = this._mintInner(tokenA, tokenB, amountAStr, amountBStr, toAddress, false);

    return JSON.stringify([amountAStr, amountBStr, liquidity.toString(10)]);
  },

  addLiquidityNAS: function(token, amountTokenDesired, amountTokenMin, amountNASMin, toAddress) {
    this._verifyAddress(toAddress);

    amountTokenDesired = new BigNumber(amountTokenDesired);
    amountTokenMin = new BigNumber(amountTokenMin);
    amountNASMin = new BigNumber(amountNASMin);

    if (amountTokenDesired.lte(0) || amountTokenMin.lte(0) || amountNASMin.lte(0)) {
      throw "Swap: INVALID_INPUT";
    }

    const value = Blockchain.transaction.value;

    const amountArray = this._addLiquidity(
        token,
        this._wnas,
        amountTokenDesired,
        Blockchain.transaction.value,
        amountTokenMin,
        amountNASMin
    );

    const amountTokenStr = amountArray[0];
    const amountNASStr = amountArray[1];

    var wnasContract = new Blockchain.Contract(this._wnas);
    wnasContract.value(amountNASStr).call("deposit");

    const liquidity = this._mintInner(token, this._wnas, amountTokenStr, amountNASStr, toAddress, true);

    // refund dust nas, if any
    if (value.gt(amountNASStr)) {
      Blockchain.transfer(toAddress, value.minus(amountNASStr));
    }

    return JSON.stringify([amountTokenStr, amountNASStr, liquidity.toString(10)]);
  },

  removeLiquidity: function (tokenA, tokenB, liquidity, amountAMin, amountBMin, toAddress) {
    this._verifyAddress(tokenA);
    this._verifyAddress(tokenB);
    this._verifyAddress(toAddress);

    liquidity = new BigNumber(liquidity);
    amountAMin = new BigNumber(amountAMin);
    amountBMin = new BigNumber(amountBMin);

    if (liquidity.lte(0) || amountAMin.lte(0) || amountBMin.lte(0)) {
      throw "Swap: INVALID_INPUT";
    }

    const amountArray = this._burnInner(tokenA, tokenB, liquidity, toAddress);
    const amountA = new BigNumber(amountArray[0]);
    const amountB = new BigNumber(amountArray[1]);

    if (amountA.lt(amountAMin)) {
      throw "Swap: INSUFFICIENT_A_AMOUNT";
    }

    if (amountB.lt(amountBMin)) {
      throw "Swap: INSUFFICIENT_B_AMOUNT";
    }

    return [amountA.toString(10), amountB.toString(10)];
  },

  removeLiquidityNAS: function(token, liquidity, amountTokenMin, amountNASMin, toAddress) {
    return this.removeLiquidity(token, this._wnas, liquidity, amountTokenMin, amountNASMin, toAddress);
  },

  _swapByPath: function (amounts, path, toAddress, alreadyHasWNAS) {
    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    for (let i = 0; i < path.length - 1; i++) {
      var srcAddress;

      if (i == 0 && path[0] == this._wnas && alreadyHasWNAS || i != 0) {
        srcAddress = Blockchain.transaction.to;
      } else {
        srcAddress = Blockchain.transaction.from;
      }

      const dstAddress = i == path.length - 2 ? toAddress : Blockchain.transaction.to;
      this._swapInner(path[i], path[i + 1], amounts[i].toString(), "0", "0", amounts[i + 1].toString(), srcAddress, dstAddress);
    }
  },

  swapExactTokensForTokens: function (amountIn, amountOutMin, path, toAddress) {
    this._verifyValue(amountIn);
    this._verifyValue(amountOutMin);
    this._verifyAddress(toAddress);

    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    const amounts = this.getAmountsOut(amountIn, path);

    if (new BigNumber(amounts[amounts.length - 1]).lt(amountOutMin)) {
      throw 'Swap: INSUFFICIENT_OUTPUT_AMOUNT';
    }

    this._swapByPath(amounts, path, toAddress, false);

    return amounts;
  },

  swapTokensForExactTokens: function (amountOut, amountInMax, path, toAddress) {
    this._verifyValue(amountOut);
    this._verifyValue(amountInMax);
    this._verifyAddress(toAddress);

    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    const amounts = this.getAmountsIn(amountOut, path);

    if (new BigNumber(amounts[0]).gt(amountInMax)) {
      throw 'Swap: EXCESSIVE_INPUT_AMOUNT';
    }

    this._swapByPath(amounts, path, toAddress, false);

    return amounts;
  },

  swapExactNASForTokens: function(amountOutMin, path, toAddress) {
    this._verifyValue(amountOutMin);
    this._verifyAddress(toAddress);

    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    if (path[0] != this._wnas) {
      throw 'Swap: INVALID_PATH';
    }

    const amounts = this.getAmountsOut(Blockchain.transaction.value, path);

    if (new BigNumber(amounts[amounts.length - 1]).lt(amountOutMin)) {
      throw 'Swap: INSUFFICIENT_OUTPUT_AMOUNT';
    }

    var wnasContract = new Blockchain.Contract(this._wnas);
    wnasContract.value(amounts[0]).call("deposit");

    this._swapByPath(amounts, path, toAddress, true);

    return amounts;
  },

  swapTokensForExactNAS: function(amountOut, amountInMax, path, toAddress) {
    this._verifyValue(amountOut);
    this._verifyValue(amountInMax);
    this._verifyAddress(toAddress);

    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    if (path[path.length - 1] != this._wnas) {
      throw 'Swap: INVALID_PATH';
    }

    const amounts = this.getAmountsIn(amountOut, path);

    if (new BigNumber(amounts[0]).gt(amountInMax)) {
      throw 'Swap: EXCESSIVE_INPUT_AMOUNT';
    }

    this._swapByPath(amounts, path, Blockchain.transaction.to, false);

    var wnasContract = new Blockchain.Contract(this._wnas);
    wnasContract.call("withdraw", amounts[amounts.length - 1]);
    Blockchain.transfer(toAddress, new BigNumber(amounts[amounts.length - 1]));

    return amounts;
  },

  swapExactTokensForNAS: function(amountIn, amountOutMin, path, toAddress) {
    this._verifyValue(amountIn);
    this._verifyValue(amountOutMin);
    this._verifyAddress(toAddress);

    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    if (path[path.length - 1] != this._wnas) {
      throw 'Swap: INVALID_PATH';
    }

    const amounts = this.getAmountsOut(amountIn, path);

    if (new BigNumber(amounts[amounts.length - 1]).lt(amountOutMin)) {
      throw 'Swap: INSUFFICIENT_OUTPUT_AMOUNT';
    }

    this._swapByPath(amounts, path, Blockchain.transaction.to, false);

    var wnasContract = new Blockchain.Contract(this._wnas);
    wnasContract.call("withdraw", amounts[amounts.length - 1]);
    Blockchain.transfer(toAddress, new BigNumber(amounts[amounts.length - 1]));

    return amounts;
  },

  swapNASForExactTokens: function(amountOut, path, toAddress) {
    this._verifyValue(amountOut);
    this._verifyAddress(toAddress);

    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    if (path[0] != this._wnas) {
      throw 'Swap: INVALID_PATH';
    }

    const amounts = this.getAmountsIn(amountOut, path);
    if (new BigNumber(amounts[0]).gt(Blockchain.transaction.value)) {
      throw 'Swap: EXCESSIVE_INPUT_AMOUNT';
    }

    var wnasContract = new Blockchain.Contract(this._wnas);
    wnasContract.value(amounts[0]).call("deposit");

    this._swapByPath(amounts, path, toAddress, true);

    // refund dust nas, if any
    if (Blockchain.transaction.value > amounts[0]) {
      Blockchain.transfer(toAddress, Blockchain.transaction.value.minus(amounts[0]));
    }

    return amounts;
  },

  // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
  getAmountOut: function (amountIn, reserveIn, reserveOut) {
    amountIn = new BigNumber(amountIn);
    reserveIn = new BigNumber(reserveIn);
    reserveOut = new BigNumber(reserveOut);

    if (amountIn.lte(0)) {
      throw 'Swap: INSUFFICIENT_INPUT_AMOUNT';
    }

    if (reserveIn.lte(0) || reserveOut.lte(0)) {
      throw 'Swap: INSUFFICIENT_LIQUIDITY';
    }

    const amountInWithFee = amountIn.times(997);
    const numerator = amountInWithFee.times(reserveOut);
    const denominator = reserveIn.times(1000).plus(amountInWithFee);
    return numerator.div(denominator).toFixed(0, BigNumber.ROUND_DOWN);
  },

  // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
  getAmountIn: function (amountOut, reserveIn, reserveOut) {
    amountOut = new BigNumber(amountOut);
    reserveIn = new BigNumber(reserveIn);
    reserveOut = new BigNumber(reserveOut);

    if (amountOut.lte(0)) {
      throw 'Swap: INSUFFICIENT_OUTPUT_AMOUNT';
    }

    if (reserveIn.lte(0) || reserveOut.lte(0)) {
      throw 'Swap: INSUFFICIENT_LIQUIDITY';
    }

    const numerator = reserveIn.times(amountOut).times(1000);
    const denominator = reserveOut.minus(amountOut).times(997);
    return numerator.div(denominator).plus(1).toFixed(0, BigNumber.ROUND_DOWN);
  },

  // performs chained getAmountOut calculations on any number of pairs
  getAmountsOut: function (amountIn, path) {
    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    if (path.length < 2) {
      throw 'Swap: INVALID_PATH';
    }

    const amounts = [amountIn];
    for (let i = 0; i < path.length - 1; i++) {
      const pair = this.getPair(path[i], path[i + 1]);

      if (pair.token0 == path[i]) {
        amounts.push(this.getAmountOut(amounts[i], pair.reserve0, pair.reserve1));
      } else {
        amounts.push(this.getAmountOut(amounts[i], pair.reserve1, pair.reserve0));
      }
    }

    return amounts;
  },

  // performs chained getAmountIn calculations on any number of pairs
  getAmountsIn: function (amountOut, path) {
    if (typeof path === "string") {
      path = JSON.parse(path);
    }

    if (path.length < 2) {
      throw 'Swap: INVALID_PATH';
    }

    const amounts = [amountOut];
    for (let i = path.length - 1; i > 0; i--) {
      const pair = this.getPair(path[i - 1], path[i]);

      if (pair.token0 == path[i - 1]) {
        amounts.push(this.getAmountIn(amounts[path.length - 1 - i], pair.reserve0, pair.reserve1));
      } else {
        amounts.push(this.getAmountIn(amounts[path.length - 1 - i], pair.reserve1, pair.reserve0));
      }
    }

    amounts.reverse();

    return amounts;
  }
}

module.exports = Swap;


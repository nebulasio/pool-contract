/** Local simulation environment code; Do not modify */
const neblocal = require('../../lib/neblocal')
const crypto = require('../../lib/crypto')
const BigNumber = require('bignumber.js')
const Blockchain = neblocal.Blockchain
const LocalContractStorage = neblocal.LocalContractStorage
const Event = neblocal.Event
/** Local simulation environment code; End. */


var Allowed = function (obj) {
    this.allowed = {};
    this.parse(obj);
}

Allowed.prototype = {
    toString: function () {
        return JSON.stringify(this.allowed);
    },

    parse: function (obj) {
        if (typeof obj != "undefined") {
            var data = JSON.parse(obj);
            for (var key in data) {
                this.allowed[key] = new BigNumber(data[key]);
            }
        }
    },

    get: function (key) {
        return this.allowed[key];
    },

    set: function (key, value) {
        this.allowed[key] = new BigNumber(value);
    }
}

var NUSDT = function () {
    
    this.__contractName = 'NUSDT';

    LocalContractStorage.defineProperties(this, {
        _swap: null,
        _name: null,
        _symbol: null,
        _decimals: null,
        _totalSupply: {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        }
    });

    LocalContractStorage.defineMapProperties(this, {
        "_balances": {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        },
        "_allowed": {
            parse: function (value) {
                return new Allowed(value);
            },
            stringify: function (o) {
                return o.toString();
            }
        }
    });
};

NUSDT.prototype = {

    init: function () {
        this._totalSupply = new BigNumber(0);
    },

    // Returns the name of the token
    name: function () {
        return "nUSDT";
    },

    // Returns the symbol of the token
    symbol: function () {
        return "nUSDT";
    },

    // Returns the number of decimals the token uses
    decimals: function () {
        return 6;
    },

    totalSupply: function () {
        return this._totalSupply.toString(10);
    },

    balanceOf: function (owner) {
        var balance = this._balances.get(owner);

        if (balance instanceof BigNumber) {
            return balance.toString(10);
        } else {
            return "0";
        }
    },

    mint: function (to, value) {
        this._verifyAddress(to);
        this._verifyValue(value);

        var toBalance = this._balances.get(to) || new BigNumber(0);
        this._balances.set(to, toBalance.plus(value));
        this._totalSupply = this._totalSupply.plus(value);

        this._mintEvent(true, Blockchain.transaction.to, to, value);
    },

    _mintEvent: function (status, from, to, value) {
        Event.Trigger(this.name(), {
            Status: status,
            Mint: {
                from: from,
                to: to,
                value: value
            }
        });
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

    transfer: function (to, value) {
        let from = Blockchain.transaction.from;
        this._transferValue(from, to, value);
    },

    _transferValue: function (from, to, value) {
        this._verifyAddress(from);
        this._verifyAddress(to);
        this._verifyValue(value);

        value = new BigNumber(value);
        let balance = this._balances.get(from) || new BigNumber(0);

        if (balance.lt(value)) {
            throw new Error("transfer failed.");
        }

        this._balances.set(from, balance.sub(value));
        let toBalance = this._balances.get(to) || new BigNumber(0);
        this._balances.set(to, toBalance.add(value));

        this._transferEvent(true, from, to, value.toString(10));
    },

    transferFrom: function (from, to, value) {
        let spender = Blockchain.transaction.from;
        let allowed = this._allowed.get(from) || new Allowed();
        let allowedValue = allowed.get(spender) || new BigNumber(0);

        if (allowedValue.gte(value)) {
            this._transferValue(from, to, value);

            // update allowed value
            allowed.set(spender, allowedValue.sub(value));
            this._allowed.set(from, allowed);
        } else {
            throw new Error("transfer allow failed.");
        }
    },

    _transferEvent: function (status, from, to, value) {
        Event.Trigger(this.name(), {
            Status: status,
            Transfer: {
                from: from,
                to: to,
                value: value
            }
        });
    },

    approve: function (spender, currentValue, value) {
        this._verifyAddress(spender);
        this._verifyValue(currentValue);
        this._verifyValue(value);

        let from = Blockchain.transaction.from;

        let oldValue = this.allowance(from, spender);
        if (oldValue != currentValue) {
            throw new Error("current approve value mistake.");
        }

        let balance = new BigNumber(this.balanceOf(from));
        value = new BigNumber(value);

        if (balance.lt(value)) {
            throw new Error("invalid value.");
        }

        let owned = this._allowed.get(from) || new Allowed();
        owned.set(spender, value);

        this._allowed.set(from, owned);

        this._approveEvent(true, from, spender, value.toString(10));
    },

    _approveEvent: function (status, from, spender, value) {
        Event.Trigger(this.name(), {
            Status: status,
            Approve: {
                owner: from,
                spender: spender,
                value: value
            }
        });
    },

    allowance: function (owner, spender) {
        this._verifyAddress(owner);
        this._verifyAddress(spender);

        let owned = this._allowed.get(owner);
        if (owned instanceof Allowed) {
            let spenderObj = owned.get(spender);
            if (typeof spenderObj != "undefined") {
                return spenderObj.toString(10);
            }
        }
        return "0";
    }
};

module.exports = NUSDT;


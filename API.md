# PoolProxy

### 1.质押lp
```javascript
/**
 * @params
 * {
 * pooldId,质押池id;
 * amount: 金额
 * }
 * /
deposit(poolId, amount)
```

### 2.获取收益
```javascript
/**
 * @params
 * {
 * pooldId,质押池id;
 * }
 * /
claim(poolId)
```

### 3.取款
```javascript
/**
 * @params
 * {
 * pooldId,质押池id;
 * amount: 金额
 * }
 * /
withdraw(poolId,amount)
```

### 4.添加质押池
```javascript
/**
 * 仅合约data manager操作
 * @params
 * {
 * allocPoint:质押池倍率
 * lpToken:lp token address
 * withUpdate: 是否更新
 * }
 * /
add(allocPoint,lpToken,withUpdate)
```


### 5.更新质押池
```javascript
/**
 *  仅合约data manager操作
 * @params
 * {
 * poolId:质押池ID
 * allocPoint:质押池倍率
 * withUpdate: 是否更新
 * }
 * /
set(poolId,allocPoint,withUpdate)
```

### 6.获取质押池数量
```javascript
getPoolLength()
```

### 7.获取质押池信息
```javascript
/**
 * @params
 * {
 * pooldId,质押池id;
 * }
 * /
getPool(poolId)
```

### 8.获取用户质押信息
```javascript
/**
 * @params
 * {
 * user: 用户地址
 * }
 * /
getUserInfo(user)
```

### 9.获取用户质押池质押信息
```javascript
/**
 * @params
 * {
 * user: 用户地址
 * poolId: 质押池id
 * }
 * /
getUserPoolInfo(user,poolId)
```
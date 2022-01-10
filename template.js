var LONG = 1
var SHORT = -1
var IDLE = 0
var amount = 0
var account = []

function GetRecords_Binance_Swap(period, symbol) { //use json operation to get Binance real-time contract information  
    var url = "https://fapi.binance.com/fapi/v1/klines?symbol=" + symbol + "&interval=" + period       //USDT perpetual futures, fapi for futures api here
    var ret = HttpQuery(url)

    try {
        var jsonData = JSON.parse(ret)
        var records = []
        for (var i = 0; i < jsonData.length; i++) {
            records.push({
                Time: jsonData[i][0],
                Open: Number(jsonData[i][1]),
                High: Number(jsonData[i][2]),
                Low: Number(jsonData[i][3]),
                Close: Number(jsonData[i][4]),
                Volume: Number(jsonData[i][5]),
            });
        }
        return records
    } catch (e) {
        Log(e)
    }
}

function getPosition(positions, direction) { //get position information
    var ret = { Price: 0, Amount: 0, Type: "" }
    _.each(positions, function (pos) {
        if (pos.Type == direction) {
            ret = pos
        }
    })
    return ret
}

function cancellAll() { //cancel all pending orders
    while (true) {
        var orders = _C(exchange.GetOrders)
        if (orders.length == 0) {
            break
        } else {
            for (var i = 0; i < orders.length; i++) {
                exchange.CancelOrder(orders[i].Id, orders[i])
                Sleep(500)
            }
        }
        Sleep(500)
    }
}

function cover(tradeFunc, direction) { //closing function
    var mapDirection = { "closebuy": PD_LONG, "closesell": PD_SHORT }
    var positions = _C(exchange.GetPosition)
    var pos = getPosition(positions, mapDirection[direction])
    if (pos.Amount > 0) {
        cancellAll()
        exchange.SetDirection(direction)
        if (tradeFunc(-1, pos.Amount)) {
            return true
        } else {
            return false
        }
    }
    return true
}

function main() {
    /* switch between real offer and backtest */
        exchange.SetContractType("swap")
        exchange.IO("currency", "ETH_USDT")
        exchange.IO("cross", true) 

    var state = IDLE
    var hold_price = 0
    var last_balance = 0
    var current_balance = 0
    var difference = 0
    var total_profit = 0
    var total_loss = 0
    var preTime = 0
    var wins = 0
    var loses = 0

    var account = exchange.GetAccount()
    Log('已成功获取账户信息。当前账户余额为' + Number(account.Balance).toFixed(3) + 'USD')

    while (true) {
        var records_1m = GetRecords_Binance_Swap("1m", "ETHUSDT")
        var records_15m = GetRecords_Binance_Swap("15m", "ETHUSDT")

        var records_1m = exchange.GetRecords(PERIOD_M1)
        var records_15m = exchange.GetRecords(PERIOD_M15)

        var len_1m = records_1m.length
        var len_15m = records_15m.length

        //put Binance Futures API we just got above into actual data via built-in functions in order to use painting functions down below

        if (len_1m < 27 || len_15m < 25) {
            Sleep(1000)
            continue
        }

        var MACD = TA.MACD(records_1m, 12, 26, 9)
        //call built-in functions to obtain technical indicators
        //just for instance here

        // 画图函数
        $.PlotRecords(records_15m, 'K线')
        if (preTime !== records_15m[len_15m - 1].Time) {

            $.PlotLine(//painting function here)

        } else {
            //same as above
        }

        var up = /* your own judgment on trend here */;
        var down = /* same as above */;


        if (up && (state == SHORT || state == IDLE)) {

            if (state == SHORT && cover(exchange.Buy, "closesell")) {
                state = IDLE
                hold_price = 0
                account = exchange.GetAccount()
                current_balance = Number(account.Balance)
                difference = current_balance - last_balance
                if (difference > 0) {
                    wins++
                    total_profit += difference
                    Log('恭喜你，成功收米！继续努力！本次盈利为' + Number(difference).toFixed(3) + 'USD')
                    $.PlotFlag(records_15m[len_15m - 1].Time, 'coverShort', '盈利平空')
                }
                else {
                    loses++
                    total_loss += difference
                    Log('反转了，傻屄！快点改进罢！本次亏损为' + Number(Math.abs(difference)).toFixed(3) + 'USD')
                    $.PlotFlag(records_15m[len_15m - 1].Time, 'coverShort', '亏损平空')
                }
                Log('当前胜率为' + Number(wins / (wins + loses)).toFixed(3) + '，盈亏比为' + Number(Math.abs(total_profit / total_loss))).toFixed(3)
                Log('本单收益率为' + Number(difference / last_balance * 0.01).toFixed(3) + '%' + '，而当前总收益率为' + Number(total_profit / last_balance * 0.01).toFixed(3) + '%')
                last_balance = current_balance
            }

            exchange.SetMarginLevel(100)
            exchange.SetDirection("buy")
            amount = Number((account.Balance * percentage * level / records_1m[len_1m - 1].Close).toFixed(2))
            Log('当前账户余额为' + Number(account.Balance).toFixed(3) + 'USD，准备开单')
            if (exchange.Buy(-1, amount)) {
                state = LONG
                hold_price = records_1m[len_1m - 1].Close
                last_balance = Number(account.Balance)
                Log('开多单成功！下单数为' + amount + '个以太坊')
                $.PlotFlag(records_15m[len_15m - 1].Time, 'openLong', '开多')
            }

        } else if (down && (state == LONG || state == IDLE)) {

            if (state == LONG && cover(exchange.Sell, "closebuy")) {
                state = IDLE
                hold_price = 0
                account = exchange.GetAccount()
                current_balance = Number(account.Balance)
                difference = current_balance - last_balance
                if (difference > 0) {
                    wins++
                    total_profit += difference
                    Log('恭喜你，成功收米！继续努力！本次盈利为' + Number(difference).toFixed(3) + 'USD')
                    $.PlotFlag(records_15m[len_15m - 1].Time, 'coverShort', '盈利平空')
                }
                else {
                    loses++
                    total_loss += difference
                    $.PlotFlag(records_15m[len_15m - 1].Time, 'coverShort', '亏损平空')
                }
                Log('当前胜率为' + Number(wins / (wins + loses)).toFixed(3) + '，盈亏比为' + Number(Math.abs(total_profit / total_loss))).toFixed(3)
                Log('本单收益率为' + Number(difference / last_balance * 0.01).toFixed(3) + '%' + '，而当前总收益率为' + Number(total_profit / last_balance * 0.01).toFixed(3) + '%')
                last_balance = current_balance
            }

            exchange.SetMarginLevel(100)
            exchange.SetDirection("sell")
            amount = Number((account.Balance * percentage * level / records_1m[len_1m - 1].Close).toFixed(2))
            Log('当前账户余额为' + Number(account.Balance).toFixed(3) + 'USD，准备开单')
            if (exchange.Sell(-1, amount)) {
                state = SHORT
                hold_price = records_1m[len_1m - 1].Close
                last_balance = Number(account.Balance)
                Log('开空单成功！下单数为' + amount + '个以太坊')
                $.PlotFlag(records_15m[len_15m - 1].Time, 'openShort', '开空')
            }
        }

        //take profit
        if (state == LONG && records_1m[len_1m - 1].Close - hold_price >= 49.99 && cover(exchange.Sell, "closebuy", 0.25 * amount)) {
            Log('平多触发价为' + records_1m[len_1m - 1].Close)
            $.PlotFlag(records_15m[len_15m - 1].Time, 'CoverLong_1', '第一次止盈')
        } else if (state == SHORT && hold_price - records_1m[len_1m - 1].Close >= 149.99 && cover(exchange.Buy, "closesell", 0.25 * amount)) {
            Log('平空触发价为' + records_1m[len_1m - 1].Close)
            $.PlotFlag(records_15m[len_15m - 1].Time, 'CoverLong_3', '第二次止盈')
        } 

        //stop loss
        if (state == LONG && hold_price - records_1m[len_1m - 1].Close > 0.89 * loss_set && cover(exchange.Sell, "closebuy")) {

            state = IDLE
            hold_price = 0

            account = exchange.GetAccount()
            current_balance = Number(account.Balance)
            difference = current_balance - last_balance
            loses++
            total_loss += difference
            $.PlotFlag(records_1m[len_15m - 1].Time, 'stopLoss_coverLong', '止损平多')
            Log('当前胜率为' + wins / (wins + loses) + '，盈亏比为' + Math.abs(total_profit / total_loss))
            Log('本单收益率为' + difference / last_balance * 0.01 + '%' + '，而当前总收益额为' + total_profit + 'USD，总亏损额为' + total_loss + 'USD')
            last_balance = current_balance

        } else if (state == SHORT && records_1m[len_1m - 1].Close - hold_price > 0.89 * loss_set && cover(exchange.Buy, "closesell")) {

            state = IDLE
            hold_price = 0

            account = exchange.GetAccount()
            current_balance = Number(account.Balance)
            difference = current_balance - last_balance
            loses++
            total_loss += difference
            $.PlotFlag(records_1m[len_15m - 1].Time, 'stopLoss_coverLong', '止损平多')
            Log('当前胜率为' + wins / (wins + loses) + '，盈亏比为' + Math.abs(total_profit / total_loss))
            Log('本单收益率为' + difference / last_balance * 0.01 + '%' + '，而当前总收益额为' + total_profit + 'USD，总亏损额为' + total_loss + 'USD')
            last_balance = current_balance
        } 

        LogStatus(_D())
        Sleep(200)
    }
}

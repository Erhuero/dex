const { expectRevert } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const Bat = artifacts.require('mocks/Bat.sol');
const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Dex = artifacts.require('Dex.sol');

//define a variable to pass a number to buy and sell
const SIDE = {
    BUY: 0,
    SELL: 1
};

//define a contract block where we gonna have all tests
contract('Dex', (accounts) => {
    //point to our erc20 tokens
    let dai, bat, rep, zrx, dex;
    const [trader1, trader2] = [accounts[1], accounts[2]];
    const [DAI, BAT, REP, ZRX] = ['DAI', 'BAT', 'REP', 'ZRX'].map(ticker => web3.utils.fromAscii(ticker)); 
    //run before each test
    beforeEach(async() => {
        //we can interact with our tokens by using these variables
        ([dai, bat, rep, zrx] = await Promise.all([
            //return a full array of instances
            Dai.new(),
            Bat.new(),
            Rep.new(),
            Zrx.new()
        ]));
        //deploy dex
        dex = await Dex.new();
        //add token for each token
        await Promise.all([
            dex.addToken(DAI, dai.address),
            dex.addToken(BAT, bat.address),
            dex.addToken(REP, rep.address),
            dex.addToken(ZRX, zrx.address)
        ]);

        const amount = web3.utils.toWei('1000');
        const seedTokenBalance = async (token, trader) => {
            //allocate tokens to an address
            await token.faucet(trader, amount);
            //trader will approve the dex to transfer the tokens
            //specify address of the dex
            //approve the DEX to spend the tokens on behalf of the trader
            await token.approve(
                dex.address,
                amount,
                {from : trader}
            );
        };
        //trader 1
        await Promise.all(
            [dai, bat, rep, zrx].map(
                token => seedTokenBalance(token, trader1)
            )
        );
        //then deposit token fro trader to contract of the DEX
        //trader 2
        await Promise.all(
            [dai, bat, rep, zrx].map(
                token => seedTokenBalance(token, trader2)
            )
        );
    });
    //happy path
    it('Deposez les tokens d abord', async () => {
        const amount = web3.utils.toWei('100');

        await dex.deposit(
            amount,
            DAI,
            {from: trader1}
        );
        
        
        const balance = await dex.traderBalances(trader1, DAI);
        //balance to string and compare the string to the amount which should be equal
        assert(balance.toString() === amount);
    });

    it('Impossible de deposer le token si il existe pas', async ()=> {
        await expectRevert(
            dex.deposit(
                web3.utils.toWei('100'),
                web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
                {from: trader1}
            ),
            'this token does not exist'
        );
    });
    //withdraw balance case
    //deposit and withdraw 100 DAI
    //at the end the accout will full and the DEX will be empty
    it('Possible de retirer les jetons', async () => {
        const amount = web3.utils.toWei('100');

        await dex.deposit(
            amount,
            DAI,
            {from: trader1}
        );

        await dex.withdraw(
            amount,
            DAI,
            {from: trader1}
        );
        //deposit tokens and withdraw this amounts
        //get the token balance from the dexs
        const [balanceDex, balanceDai] = await Promise.all([//store the result in 2 variables
            dex.traderBalances(trader1, DAI),
            dai.balanceOf(trader1)
        ]);
        //run 2 assertions
        //balance of DEX should be 0
        assert(balanceDex.isZero());
        //balance of DAi should be the initial balance of the trader
        assert(balanceDai.toString() === web3.utils.toWei('1000'));
    });

    it('Pas possible de retirer les jetons si le jeton n existe pas', async () => {
        await expectRevert(
            dex.withdraw(
                web3.utils.toWei('100'),
                web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
                {from: trader1}
            ),
            'this token does not exist'
        );
    });

    it('Pas possible de retirer les jetons si la balance est trop faible', async () => {
        await dex.deposit(
            //try to withdraw 1000 tokens
            web3.utils.toWei('100'),
            DAI,
            {from: trader1}
        );
        await expectRevert(
            dex.withdraw(
                web3.utils.toWei('1000'),
                DAI,
                {from: trader1}
            ),
            'balance too low'
        );
    });

    //create limit order function, which allow to place orders in a mart contract
    //to buy or sell tokens
    //trade amount and price
    //check if we have enough balance
    //check DAI balance is enough
    //5 tests
    
    it('Vous devez creer une limite pour ordre', async () => {
    await dex.deposit(
        //try to withdraw 1000 tokens
        web3.utils.toWei('100'),
        DAI,
        {from: trader1}
    );

    //create limite order for the REP token
    //we have deposited 100 tokens which is enough to create an order
    await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,
        //specify the sender of the transaction
        {from : trader1}
    );

    //let to rebind only on the nex 2 variables
    let buyOrders = await dex.getOrders(REP, SIDE.BUY);
    let sellOrders = await dex.getOrders(REP, SIDE.SELL);
    //next there is 2 assertions
    assert(buyOrders.length === 1);
    //inspect the specific order we are created
    //access at the first index of the array the trader should be the trader1
    assert(buyOrders[0].trader === trader1);
    //ticker have an 0 on the right that's why we add web3 padRight
    //assertions with byte32 should be with pad
    assert(buyOrders[0].ticker === web3.utils.padRight(REP, 64));    
    assert(buyOrders[0].price === '10');
    //amount of the price should be equal to 10 tokens
    assert(buyOrders[0].amount === web3.utils.toWei('10'));
    //sell Orders
    assert(sellOrders.length === 0);

    //make sure if the new limit order will be added in the order book
    //at the correct place
    //use ano other trader
    await dex.deposit(
        web3.utils.toWei('200'),
        DAI,
        {from: trader2}
    );
    
    await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        11,
        SIDE.BUY,
        //specify the sender of the transaction
        {from : trader2}
    );
    //get list of orders of buy and sell list
    buyOrders = await dex.getOrders(REP, SIDE.BUY);
    sellOrders = await dex.getOrders(REP, SIDE.SELL);
    assert(buyOrders.length === 2);
    //check if the order was inserted in the right position
    //the first order should be the order of trader 2 because of best price (11)
    //order book should be ordered by the best price before
    assert(buyOrders[0].trader === trader2);
    //after that this should the order of the trader 1
    assert(buyOrders[1].trader === trader1);
    //should be empty
    assert(sellOrders.length === 0);

    //third position because of the lower price
    await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        9,
        SIDE.BUY,
        //specify the sender of the transaction
        {from : trader2}
    );
    buyOrders = await dex.getOrders(REP, SIDE.BUY);
    sellOrders = await dex.getOrders(REP, SIDE.SELL);
    assert(buyOrders.length === 3);
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[1].trader === trader1);
    assert(buyOrders[2].trader === trader2);
    assert(buyOrders[2].price === '9');
    assert(sellOrders.length === 0);
    });


    //test with a non existent token
    it('Should not create limit order if token does not exist', async() => {
        await expectRevert(
            dex.createLimitOrder(
                web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
                web3.utils.toWei('1000'),
                10,
                SIDE.BUY,
                {from: trader1}
            ),
            'this token does not exist'
        );
    });

    //test with a DAI token
    it('Should not create limit order if token is DAI', async() => {
        await expectRevert(
            dex.createLimitOrder(
                DAI,                
                web3.utils.toWei('1000'),
                10,
                SIDE.BUY,
                {from: trader1}
            ),
            'cannot trade DAI'
        );
    });

    it('Pas possible de creer ordre limite car la balance des jetons est trop basse', async () => {
        await dex.deposit(
            web3.utils.toWei('99'),
            REP,
            {from: trader1}
        );

        await expectRevert(
            dex.createLimitOrder(
                REP,
                web3.utils.toWei('100'),
                10,
                SIDE.SELL,
                {from: trader1}
            ),
            'token balance too low'
        );
    });

        //try to buy DAI token but we dont have enough
        it('Pas possible de creer ordre limite car la balance des DAI est trop basse', async () => {
            await dex.deposit(
                web3.utils.toWei('99'),
                DAI,
                {from: trader1}
            );
    
            await expectRevert(
                dex.createLimitOrder(
                    REP,
                    web3.utils.toWei('10'),
                    10,
                    SIDE.BUY,
                    {from: trader1}
                ),
                'dai balance too low'
            );
        });

    it('Should create market order and match against existing limit order', async () =>
{
    await dex.deposit(
        web3.utils.toWei('100'),
        DAI,
        {from: trader1}
    );
    //limit order for REP
    await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,
        {from: trader1}
    );
    //fund the balance of 2 traders in REP
    //send 100 REP from trader 2
    await dex.deposit(
        web3.utils.toWei('100'),
        REP,
        {from: trader2}
    );
    //consume a part of the balance of the trader 2
    //and consume a part of the limit order
    await dex.createMarketOrder(
        REP,
        web3.utils.toWei('5'),
        SIDE.SELL,
        {from: trader2}
    );
        //get several balances 
    const balances = await Promise.all([
        dex.traderBalances(trader1, DAI),
        dex.traderBalances(trader1, REP),
        dex.traderBalances(trader2, DAI),
        dex.traderBalances(trader2, REP),
    ]);
    //want the order book on the buy side
    //just to make sure that the limit order of the first trader
    //have been partially filled
    const orders = await dex.getOrders(REP, SIDE.BUY);
    //assert(orders.length === 1);
    //the order of the trader 1 has been filled for 5 tokens
    //market order of the trader 2
    assert(orders[0].filled === web3.utils.toWei('5'));
    //check that the dai balance of the DAI balance is 50 because it was used to buy REP token
    assert(balances[0].toString() === web3.utils.toWei('50'));
    assert(balances[1].toString() === web3.utils.toWei('5'));
    assert(balances[2].toString() === web3.utils.toWei('50'));
    //now has 95 because sold 5
    assert(balances[3].toString() === web3.utils.toWei('95'));
    });

    it('should NOT create market order if token balance too low', async () => {
        await expectRevert(
          dex.createMarketOrder(
            REP,
            web3.utils.toWei('101'),
            SIDE.SELL,
            {from: trader2}
          ),
          'token balance too low'
        );
      });
    
      it('should NOT create market order if dai balance too low', async () => {
        await dex.deposit(
          web3.utils.toWei('100'),
          REP,
          {from: trader1}
        );
      
        await dex.createLimitOrder(
          REP,
          web3.utils.toWei('100'),
          10,
          SIDE.SELL,
          {from: trader1}
        );
    
        await expectRevert(
          dex.createMarketOrder(
            REP,
            web3.utils.toWei('101'),
            SIDE.BUY,
            {from: trader2}
          ),
          'dai balance too low'
        );
      });
    
      it('should NOT create market order if token is DAI', async () => {
        await expectRevert(
          dex.createMarketOrder(
            DAI,
            web3.utils.toWei('1000'),
            SIDE.BUY,
            {from: trader1}
          ),
          'cannot trade DAI'
        );
      });
    
      it('should NOT create market order if token does not not exist', async () => {
        await expectRevert(
          dex.createMarketOrder(
            web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
            web3.utils.toWei('1000'),
            SIDE.BUY,
            {from: trader1}
          ),
          'this token does not exist'
        );
      });
    });
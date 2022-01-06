// @dev. This script will deploy this V1.1 of Olympus. It will deploy the whole ecosystem except for the LP tokens and their bonds. 
// This should be enough of a test environment to learn about and test implementations with the Olympus as of V1.1.
// Not that the every instance of the Treasury's function 'valueOf' has been changed to 'valueOfToken'... 
// This solidity function was conflicting w js object property name

const { ethers } = require("hardhat");

async function main(_config = {}) {

    const [ deployer, MockDAO, governor, guardian, policy, dex, user1, user2, user3, user4, user5 ] = await ethers.getSigners();

    users = [user1 , user2, user3, user4, user5]

    console.log('Deploying contracts with the account: ' + deployer.address);

    const currentBlock = await ethers.provider.getBlock(await (ethers.provider.getBlockNumber()));

    const config = Object.assign({
        firstEpoch: 1,

        rebaseTime: 2200,
        timelockBlocks: parseInt(86400 / 3),
        rewardRate: 1000_000, // 1% (8 decimals)
        // fixme!
        initialReward: ethers.utils.parseUnits('500', 9),
        principalDeposit: {
            amount: ethers.utils.parseUnits('2000', 18),
            profit: ethers.utils.parseUnits('500', 9),
        },
    }, _config);

    // Initial staking index
    const initialIndex = '1000000000'
                            
    // First block epoch occurs
    const firstEpochBlock = '8961000';

    // What epoch will be first epoch
    const firstEpochNumber = '1';

    // How many blocks are in each epoch
    const epochLengthInBlocks = '50';

    // Initial reward rate for epoch
    const initialRewardRate = '10000';

    // Ethereum 0 address, used when toggling changes in treasury
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    // Large number for approval for Frax and DAI
    const largeApproval = '100000000000000000000000000000000';

    // Initial mint for Frax and DAI (10,000,000)
    const initialMint = '10000000000000000000000000';

    // DAI bond BCV
    const daiBondBCV = '369';

    // Frax bond BCV
    const fraxBondBCV = '690';

    // Bond vesting length in blocks. 33110 ~ 5 days
    const bondVestingLength = '33110';

    // Min bond price
    const minBondPrice = '50000';

    // Max bond payout
    const maxBondPayout = '50'

    // DAO fee for bond
    const bondFee = '10000';

    // Max debt bond can take on
    const maxBondDebt = '1000000000000000';

    // Initial Bond debt
    const intialBondDebt = '0'

    console.log('Provider:', ethers.provider.connection.url, ethers.provider.network?.chainId);

    console.log('Block: ', await ethers.provider.getBlockNumber(), ethers.utils.formatEther(await ethers.provider.getGasPrice()).toString())

    console.log('Deployer:', deployer.address, ethers.utils.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');

    console.log('Governor:', governor.address);

    // Deploy OHM
    const OHM = await ethers.getContractFactory('OlympusERC20Token');
    const ohm = await OHM.deploy();

    // Deploy DAI
    const DAI = await ethers.getContractFactory('DAI');
    const dai = await DAI.deploy( 0 );

    // Deploy Frax
    const Frax = await ethers.getContractFactory('FRAX');
    const frax = await Frax.deploy( 0 );

    // Deploy 10,000,000 mock DAI and mock Frax
    await dai.mint( deployer.address, initialMint );
    await frax.mint( deployer.address, initialMint );
    await dai.mint( governor.address, initialMint );

    // Deploy treasury
    //@dev changed function in treaury from 'valueOf' to 'valueOfToken'... solidity function was coflicting w js object property name
    const Treasury = await ethers.getContractFactory('MockOlympusTreasury'); 
    const treasury = await Treasury.deploy( ohm.address, dai.address, frax.address, 0 );

    // Deploy bonding calc
    const OlympusBondingCalculator = await ethers.getContractFactory('OlympusBondingCalculator');
    const olympusBondingCalculator = await OlympusBondingCalculator.deploy( ohm.address );
    // Deploy staking distributor
    const Distributor = await ethers.getContractFactory('Distributor');

    console.log("startblock :" , startBlock = await ethers.provider.getBlockNumber())
    const distributor = await Distributor.deploy(treasury.address, ohm.address, epochLengthInBlocks, 8);

    // Deploy sOHM
    const SOHM = await ethers.getContractFactory('sOlympus');
    const sOHM = await SOHM.deploy();
    
    // Deploy Staking
    const Staking = await ethers.getContractFactory('OlympusStaking');
    const staking = await Staking.deploy( ohm.address, sOHM.address, epochLengthInBlocks, firstEpochNumber, 8);

    // Deploy staking warmpup
    const StakingWarmpup = await ethers.getContractFactory('StakingWarmup');
    const stakingWarmup = await StakingWarmpup.deploy(staking.address, sOHM.address);

    // Deploy staking helper
    const StakingHelper = await ethers.getContractFactory('StakingHelper');
    const stakingHelper = await StakingHelper.deploy(staking.address, ohm.address);

    // Deploy DAI bond
    //@dev changed function call to Treasury of 'valueOf' to 'valueOfToken' in BondDepository due to change in Treausry contract
    const DAIBond = await ethers.getContractFactory('MockOlympusBondDepository');
    const daiBond = await DAIBond.deploy(ohm.address, dai.address, treasury.address, MockDAO.address, zeroAddress);

    // Deploy Frax bond
    //@dev changed function call to Treasury of 'valueOf' to 'valueOfToken' in BondDepository due to change in Treausry contract
    const FraxBond = await ethers.getContractFactory('MockOlympusBondDepository');
    const fraxBond = await FraxBond.deploy(ohm.address, frax.address, treasury.address, MockDAO.address, zeroAddress);

    // queue and toggle DAI and Frax bond reserve depositor
    await treasury.queue('0', daiBond.address);
    await treasury.queue('0', fraxBond.address);
    await treasury.toggle('0', daiBond.address, zeroAddress);
    await treasury.toggle('0', fraxBond.address, zeroAddress);

    // Set DAI and Frax bond terms
    await daiBond.initializeBondTerms(daiBondBCV, bondVestingLength, minBondPrice, maxBondPayout, bondFee, maxBondDebt, intialBondDebt);
    await fraxBond.initializeBondTerms(fraxBondBCV, bondVestingLength, minBondPrice, maxBondPayout, bondFee, maxBondDebt, intialBondDebt);

    // Set staking for DAI and Frax bond
    await daiBond.setStaking(staking.address, stakingHelper.address);
    await fraxBond.setStaking(staking.address, stakingHelper.address);

    // Initialize sOHM and set the index
    await sOHM.initialize(staking.address);
    await sOHM.setIndex(initialIndex);

    // set distributor contract and warmup contract
    await staking.setContract('0', distributor.address);
    await staking.setContract('1', stakingWarmup.address);

    // Set treasury for OHM token
    await ohm.setVault(treasury.address);

    // Add staking contract as distributor recipient
    await distributor.addRecipient(staking.address, initialRewardRate);

    // queue and toggle reward manager
    await treasury.queue('8', distributor.address);
    await treasury.toggle('8', distributor.address, zeroAddress);

    // queue and toggle deployer reserve depositor
    await treasury.queue('0', deployer.address);
    await treasury.toggle('0', deployer.address, zeroAddress);

    // queue and toggle liquidity depositor
    await treasury.queue('4', deployer.address, );
    await treasury.toggle('4', deployer.address, zeroAddress);

    // Approve the treasury to spend DAI and Frax
    await dai.connect(governor).approve(treasury.address, largeApproval );
    await frax.connect(governor).approve(treasury.address, largeApproval );

    // Approve dai and frax bonds to spend deployer's DAI and Frax
    await dai.connect(governor).approve(daiBond.address, largeApproval );
    await frax.connect(governor).approve(fraxBond.address, largeApproval );

    // Approve staking and staking helper contact to spend deployer's OHM
    await ohm.connect(governor).approve(staking.address, largeApproval);
    await ohm.connect(governor).approve(stakingHelper.address, largeApproval);

    // queue and toggle governor for deposit
    await treasury.queue('0', governor.address, );
    await treasury.toggle('0', governor.address, zeroAddress);
    const log = async (i) => {
        console.log('log:',
            'index = ', ethers.utils.formatUnits(await sOHM.index(), 9),
            'ts =', ethers.utils.formatUnits((await ohm.totalSupply()).toString(),9),
            'ss =', ethers.utils.formatUnits((await sOHM.totalSupply()).toString(),9),
            'cs =', ethers.utils.formatUnits((await sOHM.circulatingSupply()).toString(),9),
            'epoch =', (await staking.epoch()).toString(),
            (i) ? 'rebase['+i+'] ='+(await sOHM.rebases(i)).toString() : null,
            'excessReserves' , ethers.utils.formatUnits((await treasury.excessReserves()).toString(),9)
        );
    };
    console.log("--------- Prepare scenario -----------");
    await treasury.connect(governor).deposit(ethers.utils.parseUnits('100000', 18), dai.address, ethers.utils.parseUnits('50000', 9));
    await stakingHelper.connect(governor).stake(ethers.utils.parseUnits('50000', 9));
    await log(0);
    await skipTime(50)
    await staking.rebase()
    await log(0);
    console.log("------ Finish Prepare scenario -------")
    
    console.log("--------- Mint ohm for users -----------");
    tx = await treasury.connect(governor).deposit(ethers.utils.parseUnits('100000', 18), dai.address, ethers.utils.parseUnits('50000', 9));
    for (let i = 0; i < 5; i++) {
        await ohm.connect(governor).transfer(users[i].address, ethers.utils.parseUnits('10000', 9));
    }   
    await userTable(ohm, sOHM, users)
    console.log("------ Finish mint ohm for users -------")
    console.log("\n")

    console.log("-------------- Phase 1 ----------------")  
    await action(ohm, stakingHelper, users, [0,1,3], ['2000','3000','5000'])
    await userTable(ohm, sOHM, users)
    await log(0);
    console.log("RebaseBlock :" , await ethers.provider.getBlockNumber())
    await skipTime(50)
    await staking.rebase()
    await userTable(ohm, sOHM, users)
    await log(0);
    console.log("------------ End phase 1 --------------")
    console.log("\n")


    console.log("-------------- Phase 2 ----------------")
    await action(ohm, stakingHelper, users, [2,4], ['6000','4000'])
    await userTable(ohm, sOHM, users)
    await log(0);
    console.log("RebaseBlock :" , await ethers.provider.getBlockNumber())
    await skipTime(50)
    await staking.rebase()
    await userTable(ohm, sOHM, users)
    await log(0);
    console.log("------------ End phase 2 --------------")
    console.log("\n")


    console.log("-------------- Phase 3 ----------------")
    var index = ethers.utils.formatUnits(await sOHM.index(), 9)
    await sOHM.connect(user2).approve(staking.address, ethers.utils.parseUnits('2000000', 9))
    await staking.connect(user2).unstake(ethers.utils.parseUnits(('1000'*index).toString(), 9), false);
    await action(ohm, stakingHelper, users, [2], ['2000'])
    await userTable(ohm, sOHM, users)
    await log(0);
    console.log("RebaseBlock :" , await ethers.provider.getBlockNumber())
    await skipTime(50)
    await staking.rebase()
    await userTable(ohm, sOHM, users)
    await log(0);
    console.log("------------ End phase 3 --------------")
    console.log("\n")


    console.log("-------------- Phase 4 ----------------")
    var index = ethers.utils.formatUnits(await sOHM.index(), 9)
    await action(ohm, stakingHelper, users, [0], ['8000'])
    await sOHM.connect(user5).approve(staking.address, ethers.utils.parseUnits('2000000', 9))
    const amount = ethers.utils.parseUnits(('2000'*index).toString().slice(0,9), 9)
    console.log(amount)
    await staking.connect(user5).unstake(amount, false);
    await userTable(ohm, sOHM, users)
    await log(0);
    console.log("RebaseBlock :" , await ethers.provider.getBlockNumber())
    await skipTime(50)
    await staking.rebase()
    await userTable(ohm, sOHM, users)
    await log(0);
    console.log("------------ End phase 4 --------------")
    console.log("\n")
}

async function userTable(ohm, sOHM, users) {
    console.table([
        ["Users", "Ohm balance", "sOhm balance", "sOhm/index"],
        [1, ethers.utils.formatUnits(await ohm.balanceOf(users[0].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[0].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[0].address), 9)/ ethers.utils.formatUnits(await sOHM.index(), 9)],
        [2, ethers.utils.formatUnits(await ohm.balanceOf(users[1].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[1].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[1].address), 9)/ ethers.utils.formatUnits(await sOHM.index(), 9)],
        [3, ethers.utils.formatUnits(await ohm.balanceOf(users[2].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[2].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[2].address), 9)/ ethers.utils.formatUnits(await sOHM.index(), 9)],
        [4, ethers.utils.formatUnits(await ohm.balanceOf(users[3].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[3].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[3].address), 9)/ ethers.utils.formatUnits(await sOHM.index(), 9)],
        [5, ethers.utils.formatUnits(await ohm.balanceOf(users[4].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[4].address), 9), ethers.utils.formatUnits(await sOHM.balanceOf(users[4].address), 9)/ ethers.utils.formatUnits(await sOHM.index(), 9)]
    ]);
}

async function metadataTable(ohm, sOHM, treasury, staking, i){
    console.table([
        ["Type", "data"],
        ['index', ethers.utils.formatUnits(await sOHM.index(), 9)],
        ['total supply', ethers.utils.formatUnits((await ohm.totalSupply()).toString(),9)],
        ['staked', ethers.utils.formatUnits((await sOHM.circulatingSupply()).toString(),9)],
        ['epoch', (await staking.epoch()).toString()]
        ['rebase['+i+']', (i) ? 'rebase['+i+'] ='+(await sOHM.rebases(i)).toString() : null],
        ['excessReserves', ethers.utils.formatUnits((await treasury.excessReserves()).toString(),9)]
    ]);
}

async function action(ohm, helper, users, who, amount){
    for (let i = 0; i < who.length; i++) {
        await ohm.connect(users[who[i]]).approve(helper.address, ethers.utils.parseUnits('2000000', 9));
        await helper.connect(users[who[i]]).stake(ethers.utils.parseUnits(amount[i], 9));
    }
}

async function skipTime(times){
    for (let i = 0; i < times; i++) {
        tx = await ethers.provider.send("evm_mine", [(await ethers.provider.getBlock(await (ethers.provider.getBlockNumber()))).timestamp + 1]); 
    }
}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})

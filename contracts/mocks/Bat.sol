pragma solidity >=0.4.22 <0.9.0;
//SPDX-License-Identifier:UNLICENSED
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Bat is ERC20 {
  constructor() ERC20('BAT', 'Brave browser token') public {}

  function faucet(address to, uint amount) external {
    _mint(to, amount);
  }
}

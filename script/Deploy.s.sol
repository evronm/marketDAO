
// Deploy.s.sol
import {Script} from "forge-std/Script.sol";
import {MarketDAO} from "../src/MarketDAO.sol";

contract Deploy is Script {
    function run() public returns (MarketDAO) {
        vm.startBroadcast();
        
        MarketDAO dao = new MarketDAO(
            "Market DAO",
            20,  // supportThreshold
            40,  // quorumPercentage
            7 days,  // proposal Max Age
            7 days,  // electionDuration
            "" //URI:  This is probably not needed; will ditch later
        );
        
        vm.stopBroadcast();
        return dao;
    }
}

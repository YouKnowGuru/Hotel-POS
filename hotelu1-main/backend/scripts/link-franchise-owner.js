/**
 * Link a franchise user to a sub-franchise location.
 * Usage: node scripts/link-franchise-owner.js <franchise_username> <location_code>
 * Example: node scripts/link-franchise-owner.js Franchisenear SAQWA
 */
require("dotenv").config();
const sequelize = require("../models/sequelize");
const User = require("../models/User");
const SubFranchise = require("../models/SubFranchise");

async function main() {
  const [username, code] = process.argv.slice(2);
  if (!username || !code) {
    console.error("Usage: node scripts/link-franchise-owner.js <username> <location_code>");
    process.exit(1);
  }
  await sequelize.authenticate();
  const user = await User.findOne({ where: { username } });
  if (!user || user.role !== "franchise") {
    console.error(`Franchise user not found: ${username}`);
    process.exit(1);
  }
  const loc = await SubFranchise.findOne({ where: { code } });
  if (!loc) {
    console.error(`Location not found with code: ${code}`);
    process.exit(1);
  }
  await loc.update({ owner_user_id: user.id });
  await user.update({ subfranchise_id: loc.id });
  console.log(`Linked ${username} (id ${user.id}) → location "${loc.name}" (${code}, id ${loc.id})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

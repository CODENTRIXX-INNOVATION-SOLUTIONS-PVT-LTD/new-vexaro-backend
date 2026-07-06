const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/modules/users/user.model');
const { Wallet } = require('./src/modules/finance/finance.model');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/vexaro?replicaSet=rs0');

  const email = 'distributor@vexaro.com';

  let user = await User.findOne({ email });

  if (user) {
    console.log('✓ Distributor already exists:', user._id.toString());
  } else {
    const passwordHash = await bcrypt.hash('Dist@123456', 12);
    user = await User.create({
      email,
      passwordHash,
      role: 'DISTRIBUTOR',
      isActive: true,
      mustChangeCredentials: false,
      firstName: 'Test',
      lastName: 'Distributor',
      phone: '9876543210',
      companyName: 'Test Distribution Co.',
    });
    console.log('✓ Distributor created:', user._id.toString());
  }

  const existingWallet = await Wallet.findOne({ userId: user._id });
  if (existingWallet) {
    console.log('✓ Wallet already exists | Balance: ₹' + existingWallet.balance.toLocaleString('en-IN'));
  } else {
    const wallet = await Wallet.create({ userId: user._id, balance: 10000 });
    console.log('✓ Wallet created with ₹10,000 | ID:', wallet._id.toString());
  }

  console.log('\nDistributor login credentials:');
  console.log('  Email   :', email);
  console.log('  Password: Dist@123456');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });

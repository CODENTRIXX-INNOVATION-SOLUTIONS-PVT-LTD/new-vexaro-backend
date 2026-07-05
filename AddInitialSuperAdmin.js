const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/modules/users/user.model');
const { Wallet } = require('./src/modules/finance/finance.model');
const { UserRole } = require('./src/constants');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/vexaro');

  let user = await User.findOne({ email: 'vishwasgour2002@gmail.com' });

  if (user) {
    console.log('✓ Super Admin user already exists:', user._id.toString());
  } else {
    const passwordHash = await bcrypt.hash('vishwasgour2002@gmail.com', 12);
    user = await User.create({
      email: 'vishwasgour2002@gmail.com',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      mustChangeCredentials: true,   // forced on first login
      firstName: 'Vishwas',
      lastName: 'Gour',
      phone: '9999999999',
      companyName: 'Vexaro',
      address: 'Bhopal',
    });
    console.log('✓ Super Admin created:', user._id.toString());
  }

  // Create wallet if it doesn't exist yet
  const existingWallet = await Wallet.findOne({ userId: user._id });
  if (existingWallet) {
    console.log('✓ Wallet already exists  | Balance: ₹' + existingWallet.balance.toLocaleString('en-IN'));
  } else {
    const wallet = await Wallet.create({ userId: user._id, balance: 0 });
    console.log('✓ Wallet created         | ID:', wallet._id.toString());
  }

  console.log('\nLogin credentials:');
  console.log('  Email   :', 'vishwasgour2002@gmail.com');
  console.log('  Password:', 'vishwasgour2002@gmail.com');
  console.log('\n⚠  Change the password after first login!\n');

  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/modules/users/user.model');
const { UserRole } = require('./src/constants');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/vexaro');

  const existing = await User.findOne({
    email: 'vishwasgour2002@gmail.com',
  });

  if (existing) {
    console.log('User already exists');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash('vishwasgour2002@gmail.com', 12);

  await User.create({
    email: 'vishwasgour2002@gmail.com',
    passwordHash,
    role: UserRole.SUPER_ADMIN,
    isActive: true,
    mustChangeCredentials: false,
    firstName: 'Vishwas',
    lastName: 'Gour',
    phone: '9999999999',
    companyName: 'Vexaro',
    address: 'Bhopal',
  });

  console.log('Super Admin created');
  process.exit(0);
}

seed().catch(console.error);
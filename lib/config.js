const isProd = process.env.NODE_ENV === 'production';
module.exports = {
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || (isProd ? process.env.PROD_URL : 'http://localhost:3000'),
};

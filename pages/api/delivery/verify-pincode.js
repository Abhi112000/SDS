function distanceKm(lat1, lon1, lat2, lon2) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { pincode } = req.body || {};
  if (!/^\d{6}$/.test(String(pincode || ''))) return res.status(400).json({ error: 'Enter a valid 6-digit pincode.' });
  if (String(pincode) === '201002') return res.status(200).json({ pincode, distanceKm: 0, estimatedCharge: 0, sameShopPincode: true });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`, { headers: { 'User-Agent': 'Shree-Durga-Stationary/1.0' } });
    const places = await response.json();
    if (!places?.[0]) return res.status(404).json({ error: 'This pincode could not be located. Share the delivery location for exact calculation.' });
    const distance = distanceKm(28.7019507, 77.4614106, Number(places[0].lat), Number(places[0].lon));
    const estimatedCharge = distance <= 8 ? 0 : distance <= 9 ? 10 : distance <= 10 ? 15 : distance <= 12 ? 20 : 25;
    return res.status(200).json({ pincode, distanceKm: Number(distance.toFixed(2)), estimatedCharge, sameShopPincode: false });
  } catch (error) {
    return res.status(502).json({ error: 'Pincode verification is temporarily unavailable. Share the delivery location for exact calculation.' });
  }
}
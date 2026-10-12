/** "Nikole Pašića 27, 18000 Niš" already names the city, so don't repeat it. */
export function fullAddress(salon: { address: string; city: string }): string {
  return salon.address.toLowerCase().includes(salon.city.toLowerCase())
    ? salon.address
    : `${salon.address}, ${salon.city}`;
}

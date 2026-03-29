const EXCHANGE_RATE_API = process.env.EXCHANGE_RATE_API || 'https://api.exchangerate-api.com/v4/latest';

export async function getExchangeRates(baseCurrency, prisma) {
  // Check cache first (1 hour TTL)
  const cached = await prisma.exchangeRateCache.findUnique({
    where: { baseCurrency },
  });

  if (cached) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (age < 3600000) { // 1 hour
      return JSON.parse(cached.rates);
    }
  }

  // Fetch fresh rates
  try {
    const response = await fetch(`${EXCHANGE_RATE_API}/${baseCurrency}`);
    const data = await response.json();

    // Cache the rates
    await prisma.exchangeRateCache.upsert({
      where: { baseCurrency },
      update: {
        rates: JSON.stringify(data.rates),
        fetchedAt: new Date(),
      },
      create: {
        baseCurrency,
        rates: JSON.stringify(data.rates),
      },
    });

    return data.rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    // Return cached rates if available, even if expired
    if (cached) {
      return JSON.parse(cached.rates);
    }
    throw new Error('Exchange rate service unavailable');
  }
}

export async function convertCurrency(amount, fromCurrency, toCurrency, prisma) {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, exchangeRate: 1 };
  }

  const rates = await getExchangeRates(fromCurrency, prisma);

  if (!rates[toCurrency]) {
    throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
  }

  const exchangeRate = rates[toCurrency];
  const convertedAmount = Math.round(amount * exchangeRate * 100) / 100;

  return { convertedAmount, exchangeRate };
}

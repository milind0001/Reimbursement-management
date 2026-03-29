import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const COUNTRIES_API = 'https://restcountries.com/v3.1/all?fields=name,currencies';
let countriesCache = null;
let cacheTime = 0;

// GET /api/currencies/countries - Get countries with currencies
router.get('/countries', async (req, res) => {
  try {
    // Cache for 24 hours
    if (countriesCache && Date.now() - cacheTime < 86400000) {
      return res.json(countriesCache);
    }

    const response = await fetch(COUNTRIES_API);
    const data = await response.json();

    // Transform to simpler format
    const countries = data
      .filter(c => c.currencies && Object.keys(c.currencies).length > 0)
      .map(c => {
        const currencyKey = Object.keys(c.currencies)[0];
        const currency = c.currencies[currencyKey];
        return {
          name: c.name.common,
          currencyCode: currencyKey,
          currencyName: currency.name,
          currencySymbol: currency.symbol || currencyKey,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    countriesCache = countries;
    cacheTime = Date.now();

    res.json(countries);
  } catch (error) {
    console.error('Countries API error:', error);
    // Fallback with common countries
    res.json([
      { name: 'United States', currencyCode: 'USD', currencyName: 'US Dollar', currencySymbol: '$' },
      { name: 'India', currencyCode: 'INR', currencyName: 'Indian Rupee', currencySymbol: '₹' },
      { name: 'United Kingdom', currencyCode: 'GBP', currencyName: 'British Pound', currencySymbol: '£' },
      { name: 'Germany', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€' },
      { name: 'Japan', currencyCode: 'JPY', currencyName: 'Japanese Yen', currencySymbol: '¥' },
      { name: 'Australia', currencyCode: 'AUD', currencyName: 'Australian Dollar', currencySymbol: '$' },
      { name: 'Canada', currencyCode: 'CAD', currencyName: 'Canadian Dollar', currencySymbol: '$' },
    ]);
  }
});

// GET /api/currencies/rates/:base - Get exchange rates
router.get('/rates/:base', authenticate, async (req, res) => {
  try {
    const { base } = req.params;
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
    const data = await response.json();
    res.json(data.rates);
  } catch (error) {
    console.error('Exchange rates error:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

export default router;

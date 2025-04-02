import { product } from './Net32-stock.js';

// API endpoints and data handling
class BrandsAPI {
    constructor() {
        this.baseUrl = 'https://backend-api-4679.onrender.com/api';
        this.cachedProducts = null;
    }

    async fetchProducts() {
        try {
            // If we already have cached products, return them
            if (this.cachedProducts && this.cachedProducts.length > 0) {
                console.log('Using cached products data, length:', this.cachedProducts.length);
                return this.cachedProducts;
            }
            
            // Log the attempt
            console.log('Attempting to fetch products from:', `${this.baseUrl}/products`);

            const response = await fetch(`${this.baseUrl}/products`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const apiProducts = await response.json();
            console.log('API Products received:', apiProducts.length);
            
            if (apiProducts.length > 0) {
                console.log('Sample API product:', apiProducts[0]);
            }
            
            // Map local products with API data
            const mappedProducts = product.map(item => {
                // The local product has vp_code, but API uses Sku
                const localSku = String(item.vp_code || '');
                
                // Find matching product from API data
                const apiProduct = apiProducts.find(p => 
                    p.Sku && String(p.Sku).toLowerCase() === localSku.toLowerCase()
                );
                
                if (apiProduct) {
                    console.log('Found match for:', localSku, 'with Manufacturer:', apiProduct.Manufacturer);
                }
                
                return {
                    sku: localSku, // Use the local SKU for consistency
                    description: item.description || '',
                    stockLevel: item.old_count || 0,
                    manufacturer: apiProduct ? apiProduct.Manufacturer : 'Unknown',
                    cost_price: apiProduct && apiProduct.Cost !== undefined ? Number(apiProduct.Cost) : 0
                };
            });
            
            // Cache the products for later use
            this.cachedProducts = mappedProducts;
            
            return mappedProducts;

        } catch (error) {
            console.warn('Error fetching products from API:', error.message);
            console.log('Falling back to local product data only');
            return this.getProductsWithoutBrands();
        }
    }

    // Fallback function when API is not available
    getProductsWithoutBrands() {
        console.log('Using fallback product data (local only)');
        const mappedProducts = product.map(item => ({
            sku: String(item.vp_code || ''),
            description: item.description || '',
            stockLevel: item.old_count || 0,
            manufacturer: 'Unknown',
            cost_price: 0
        }));
        
        // Cache this data too
        this.cachedProducts = mappedProducts;
        
        return mappedProducts;
    }

    // For testing - log the current base URL
    logApiUrl() {
        console.log('Current API URL:', this.baseUrl);
    }

    // Update manufacturer for a product
    async updateManufacturer(sku, newManufacturer) {
        try {
            const response = await fetch(`${this.baseUrl}/products/${sku}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Manufacturer: newManufacturer
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const updatedProduct = await response.json();
            
            // Update local cache
            if (this.cachedProducts) {
                const product = this.cachedProducts.find(p => p.sku === sku);
                if (product) {
                    product.manufacturer = newManufacturer;
                }
            }
            
            return updatedProduct;
        } catch (error) {
            console.error('Error updating manufacturer:', error);
            
            // Update local cache anyway
            if (this.cachedProducts) {
                const product = this.cachedProducts.find(p => p.sku === sku);
                if (product) {
                    product.manufacturer = newManufacturer;
                }
            }
            
            return { success: false, error: error.message };
        }
    }

    // Update cost for a product
    async updateCost(sku, newCost) {
        try {
            const response = await fetch(`${this.baseUrl}/products/${sku}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Cost: Number(newCost)
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const updatedProduct = await response.json();
            
            // Update local cache
            if (this.cachedProducts) {
                const product = this.cachedProducts.find(p => p.sku === sku);
                if (product) {
                    product.cost_price = Number(newCost);
                }
            }
            
            return updatedProduct;
        } catch (error) {
            console.error('Error updating cost:', error);
            
            // Update local cache anyway
            if (this.cachedProducts) {
                const product = this.cachedProducts.find(p => p.sku === sku);
                if (product) {
                    product.cost_price = Number(newCost);
                }
            }
            
            return { success: false, error: error.message };
        }
    }
}

export const brandsAPI = new BrandsAPI();

// Log the API URL on initialization
brandsAPI.logApiUrl(); 
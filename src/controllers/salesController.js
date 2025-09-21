const { query } = require('../config/database');
const { Parser } = require('json2csv');

// Helper function to get date range based on period
function getDateRange(period, startDate, endDate) {
  const now = new Date();
  let start = new Date();
  let end = now;

  switch (period) {
    case 'today':
      start = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      start = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      start = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'quarter':
      start = new Date(now.setMonth(now.getMonth() - 3));
      break;
    case 'year':
      start = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    case 'custom':
      start = new Date(startDate);
      end = new Date(endDate);
      break;
  }

  return { start, end };
}

// Helper function to get previous period for comparison
function getPreviousPeriod(start, end) {
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start);
  const prevStart = new Date(start.getTime() - duration);
  return { prevStart, prevEnd };
}

// Calculate percentage change
function calculateChange(current, previous) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

const salesController = {
  // Get dashboard data
  getDashboardData: async (req, res) => {
    try {
      const { period, startDate, endDate } = req.query;
      const { start, end } = getDateRange(period, startDate, endDate);
      const { prevStart, prevEnd } = getPreviousPeriod(start, end);

      // Get current period summary
      const [
        currentRevenue,
        currentOrders,
        currentShopkeepers,
        previousRevenue,
        previousOrders,
        previousShopkeepers
      ] = await Promise.all([
        // Current period revenue
        query(`
          SELECT COALESCE(SUM(total_amount), 0) as revenue
          FROM orders
          WHERE created_at BETWEEN $1 AND $2
          AND status != 'cancelled'
        `, [start, end]),

        // Current period orders
        query(`
          SELECT COUNT(*) as count
          FROM orders
          WHERE created_at BETWEEN $1 AND $2
          AND status != 'cancelled'
        `, [start, end]),

        // Current active shopkeepers
        query(`
          SELECT COUNT(DISTINCT s.id) as count
          FROM users s
          JOIN products p ON s.id = p.shopkeeper_id
          JOIN order_items oi ON p.id = oi.product_id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.created_at BETWEEN $1 AND $2
          AND o.status != 'cancelled'
          AND s.role = 'shopkeeper'
        `, [start, end]),

        // Previous period revenue
        query(`
          SELECT COALESCE(SUM(total_amount), 0) as revenue
          FROM orders
          WHERE created_at BETWEEN $1 AND $2
          AND status != 'cancelled'
        `, [prevStart, prevEnd]),

        // Previous period orders
        query(`
          SELECT COUNT(*) as count
          FROM orders
          WHERE created_at BETWEEN $1 AND $2
          AND status != 'cancelled'
        `, [prevStart, prevEnd]),

        // Previous active shopkeepers
        query(`
          SELECT COUNT(DISTINCT s.id) as count
          FROM users s
          JOIN products p ON s.id = p.shopkeeper_id
          JOIN order_items oi ON p.id = oi.product_id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.created_at BETWEEN $1 AND $2
          AND o.status != 'cancelled'
          AND s.role = 'shopkeeper'
        `, [prevStart, prevEnd])
      ]);

      const currentRevenueValue = parseFloat(currentRevenue.rows[0].revenue);
      const currentOrdersValue = parseInt(currentOrders.rows[0].count);
      const currentAvgOrder = currentOrdersValue ? currentRevenueValue / currentOrdersValue : 0;

      const previousRevenueValue = parseFloat(previousRevenue.rows[0].revenue);
      const previousOrdersValue = parseInt(previousOrders.rows[0].count);
      const previousAvgOrder = previousOrdersValue ? previousRevenueValue / previousOrdersValue : 0;

      // Get revenue trend
      const revenueTrend = await query(`
        SELECT 
          DATE_TRUNC($1, created_at) as date,
          COALESCE(SUM(total_amount), 0) as revenue
        FROM orders
        WHERE created_at BETWEEN $2 AND $3
        AND status != 'cancelled'
        GROUP BY DATE_TRUNC($1, created_at)
        ORDER BY date
      `, [
        period === 'today' ? 'hour' :
        period === 'week' ? 'day' :
        period === 'month' ? 'day' :
        period === 'quarter' ? 'week' :
        'month',
        start,
        end
      ]);

      // Get top products
      const topProducts = await query(`
        SELECT 
          p.name,
          COUNT(oi.id) as sales
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at BETWEEN $1 AND $2
        AND o.status != 'cancelled'
        GROUP BY p.id, p.name
        ORDER BY sales DESC
        LIMIT 10
      `, [start, end]);

      // Get top shopkeepers
      const topShopkeepers = await query(`
        SELECT 
          u.name,
          COUNT(DISTINCT o.id) as orders,
          COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as revenue,
          COALESCE(AVG(r.rating), 0) as rating
        FROM users u
        JOIN products p ON u.id = p.shopkeeper_id
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN ratings r ON p.id = r.product_id
        WHERE o.created_at BETWEEN $1 AND $2
        AND o.status != 'cancelled'
        AND u.role = 'shopkeeper'
        GROUP BY u.id, u.name
        ORDER BY revenue DESC
        LIMIT 5
      `, [start, end]);

      // Get recent orders
      const recentOrders = await query(`
        SELECT 
          o.id,
          u.name as customer,
          o.total_amount as amount,
          o.status,
          o.created_at
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        WHERE o.created_at BETWEEN $1 AND $2
        ORDER BY o.created_at DESC
        LIMIT 10
      `, [start, end]);

      res.json({
        summary: {
          revenue: {
            current: currentRevenueValue,
            change: calculateChange(currentRevenueValue, previousRevenueValue)
          },
          orders: {
            current: currentOrdersValue,
            change: calculateChange(currentOrdersValue, previousOrdersValue)
          },
          averageOrder: {
            current: currentAvgOrder,
            change: calculateChange(currentAvgOrder, previousAvgOrder)
          },
          shopkeepers: {
            current: parseInt(currentShopkeepers.rows[0].count),
            change: calculateChange(
              parseInt(currentShopkeepers.rows[0].count),
              parseInt(previousShopkeepers.rows[0].count)
            )
          }
        },
        revenueTrend: {
          labels: revenueTrend.rows.map(r => r.date),
          values: revenueTrend.rows.map(r => parseFloat(r.revenue))
        },
        topProducts: topProducts.rows.map(p => ({
          name: p.name,
          sales: parseInt(p.sales)
        })),
        topShopkeepers: topShopkeepers.rows.map(s => ({
          name: s.name,
          orders: parseInt(s.orders),
          revenue: parseFloat(s.revenue),
          rating: parseFloat(s.rating)
        })),
        recentOrders: recentOrders.rows.map(o => ({
          id: o.id,
          customer: o.customer,
          amount: parseFloat(o.amount),
          status: o.status
        }))
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ message: 'Error fetching dashboard data' });
    }
  },

  // Export sales report
  exportReport: async (req, res) => {
    try {
      const { period, startDate, endDate } = req.query;
      const { start, end } = getDateRange(period, startDate, endDate);

      // Get detailed sales data
      const salesData = await query(`
        SELECT 
          o.id as order_id,
          o.created_at as order_date,
          c.name as customer,
          s.name as shopkeeper,
          p.name as product,
          oi.quantity,
          oi.price_at_time as unit_price,
          (oi.quantity * oi.price_at_time) as total_amount,
          o.status
        FROM orders o
        JOIN users c ON o.customer_id = c.id
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        JOIN users s ON p.shopkeeper_id = s.id
        WHERE o.created_at BETWEEN $1 AND $2
        ORDER BY o.created_at DESC
      `, [start, end]);

      // Convert to CSV
      const fields = [
        'order_id',
        'order_date',
        'customer',
        'shopkeeper',
        'product',
        'quantity',
        'unit_price',
        'total_amount',
        'status'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(salesData.rows);

      res.header('Content-Type', 'text/csv');
      res.attachment(`sales-report-${period}.csv`);
      res.send(csv);
    } catch (error) {
      console.error('Error exporting sales report:', error);
      res.status(500).json({ message: 'Error exporting sales report' });
    }
  }
};

module.exports = salesController;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from '../css/Dashboard.module.css';
import wasteStyles from '../css/WastePrediction.module.css';
import axios from '../api/axios';

import Header from '../components/layout/Header';
import MobileBottomNav from '../components/ui/MobileBottomNav';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import RestaurantSidebar from '../components/layout/RestaurantSidebar';

const WastePrediction = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [wasteForm, setWasteForm] = useState({
    itemName: '',
    category: 'meal',
    date: today,
    preparedQuantity: '',
    soldQuantity: '',
    wastedQuantity: '', 
    mealPeriod: 'all-day',
    weather: 'cloudy',
    specialEvent: false,
    revenue: ''
  });

  const [itemNameInput, setItemNameInput] = useState('');
  const [suggestionDate, setSuggestionDate] = useState(today);

  const [bulkPredictionDate, setBulkPredictionDate] = useState(today);

  const [analytics, setAnalytics] = useState(null);
  const [wasteLogs, setWasteLogs] = useState([]);
  const [weeklyLogs, setWeeklyLogs] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [bulkSuggestions, setBulkSuggestions] = useState(null);
  const [uniqueItems, setUniqueItems] = useState([]);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const showToast = (type, title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, logsRes] = await Promise.all([
        axios.get('/waste/analytics?period=30'),
        axios.get('/waste/logs?limit=200') 
      ]);

      setAnalytics(analyticsRes.data);

      const logs = logsRes.data.logs || [];
      setWasteLogs(logs);

      organizeLogsByWeek(logs);

      const items = [...new Set(logs.map(log => log.itemName))].filter(Boolean);
      setUniqueItems(items);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('error', 'Error', 'Failed to load data');

      setAnalytics({
        summary: {
          totalPrepared: 0,
          totalSold: 0,
          totalWasted: 0,
          avgWastePercentage: 0,
          totalRevenueLoss: 0,
          totalRevenue: 0
        },
        categoryBreakdown: [],
        topWastedItems: [],
        dayPattern: []
      });
      setWasteLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const organizeLogsByWeek = (logs) => {
    const weekMap = {};

    logs.forEach(log => {
      const logDate = new Date(log.date);
      const weekStart = getWeekStart(logDate);
      const key = weekStart.toISOString().split('T')[0];

      if (!weekMap[key]) {
        weekMap[key] = {
          weekStart,
          weekEnd: new Date(weekStart.getTime() + 6 * 86400000),
          logs: []
        };
      }
      weekMap[key].logs.push(log);
    });

    const sorted = Object.values(weekMap).sort((a, b) => b.weekStart - a.weekStart);
    setWeeklyLogs(sorted);
  };

  // Given any date, I find the Monday of that week.
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const handleQuantityChange = (field, rawValue) => {
    const value = rawValue === '' ? '' : rawValue;
    const updated = { ...wasteForm, [field]: value };

    const prepared = Number(updated.preparedQuantity) || 0;
    const sold = Number(updated.soldQuantity) || 0;

    // If sold goes above prepared, I warn the user and do not calculate waste.
    if (sold > prepared) {
      showToast('error', 'Check quantities', 'Sold cannot be greater than prepared.');
      updated.wastedQuantity = '';
      setWasteForm(updated);
      return;
    }

    // Only calculate when we have some numbers
    if (prepared === 0 && sold === 0) {
      updated.wastedQuantity = '';
    } else {
      updated.wastedQuantity = prepared - sold;
    }

    setWasteForm(updated);
  };

  const handleSubmitWaste = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const prepared = Number(wasteForm.preparedQuantity);
      const sold = Number(wasteForm.soldQuantity);

      if (Number.isNaN(prepared) || Number.isNaN(sold)) {
        showToast('error', 'Missing values', 'Please enter prepared and sold quantities.');
        setSubmitting(false);
        return;
      }

      if (sold > prepared) {
        showToast('error', 'Check quantities', 'Sold cannot be greater than prepared.');
        setSubmitting(false);
        return;
      }

      const payload = {
        ...wasteForm,
        preparedQuantity: prepared,
        soldQuantity: sold,
        wastedQuantity: prepared - sold
      };

      await axios.post('/waste/logs', payload);

      showToast('success', 'Saved', 'Waste data recorded.');

      // Reset the form after a successful save
      setWasteForm({
        itemName: '',
        category: 'meal',
        date: today,
        preparedQuantity: '',
        soldQuantity: '',
        wastedQuantity: '',
        mealPeriod: 'all-day',
        weather: 'cloudy',
        specialEvent: false,
        revenue: ''
      });

      await loadData();
    } catch (error) {
      showToast('error', 'Error', error.response?.data?.message || 'Failed to save entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (id) => {
    if (!window.confirm('Delete this entry?')) return;

    try {
      await axios.delete(`/waste/logs/${id}`);
      showToast('success', 'Deleted', 'Log entry removed');
      await loadData();
    } catch {
      showToast('error', 'Error', 'Could not delete entry');
    }
  };

  const fetchSmartSuggestion = async () => {
    if (!itemNameInput) {
      showToast('error', 'Missing info', 'Enter an item name.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(
        `/waste/suggestions?itemName=${itemNameInput}&date=${suggestionDate}`
      );

      if (res.data.hasData) {
        setSuggestions(res.data);
        showToast('success', 'Ready', 'Recommendation generated.');
      } else {
        setSuggestions(null);
        showToast('info', 'No data', res.data.message);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Error', 'Failed to get recommendation.');
      setSuggestions(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPredictions = async () => {
    if (uniqueItems.length === 0) {
      showToast('error', 'No items', 'Log some data first.');
      return;
    }

    try {
      setLoading(true);

      const recommendations = await Promise.all(
        uniqueItems.map(async (itemName) => {
          try {
            const response = await axios.get(
              `/waste/suggestions?itemName=${itemName}&date=${bulkPredictionDate}`
            );

            if (response.data.hasData) {
              return {
                itemName,
                category:
                  wasteLogs.find(l => l.itemName === itemName)?.category || 'meal',
                avgHistorical: response.data.metrics.historicalAvgSold,
                peakDemand: response.data.metrics.peakDemand,
                recommended: response.data.recommended,
                predictedWaste: response.data.metrics.mlPredictedWaste,
                confidence: response.data.confidence
              };
            }
            return null;
          } catch {
            return null;
          }
        })
      );

      const filtered = recommendations.filter(r => r !== null);
      setBulkSuggestions(filtered);

      showToast('success', 'Complete', `Generated ${filtered.length} recommendations.`);
    } catch {
      showToast('error', 'Error', 'Failed to generate recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const exportBulkPredictionsPDF = () => {
    if (!bulkSuggestions || bulkSuggestions.length === 0) return;

    let csvContent =
      'Item Name,Category,Historical Avg,Peak Demand,Recommended,Predicted Waste %,Confidence\n';

    bulkSuggestions.forEach(rec => {
      csvContent += `${rec.itemName},${rec.category},${rec.avgHistorical},${rec.peakDemand},${rec.recommended},${rec.predictedWaste},${rec.confidence}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waste-recommendations-${bulkPredictionDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('success', 'Exported', 'Recommendations downloaded as CSV.');
  };

  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  if (loading && !analytics) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.dashboardContainer}>
      <Header toggleSidebar={toggleSidebar} isMobile={isMobile} />

      <div className={isMobile ? styles.mobileMainContainer : styles.mainContainer}>
        {/* Left sidebar (desktop / tablet) */}
        {!isMobile && !isTablet && (
          <RestaurantSidebar
            isMobile={false}
            isOpen={false}
            onClose={() => {}}
            currentPage="waste-prediction"
          />
        )}

        {/* Drawer sidebar (mobile / tablet) */}
        {(isMobile || isTablet) && (
          <RestaurantSidebar
            isMobile={true}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            currentPage="waste-prediction"
          />
        )}

        <div className={styles.mainContent}>
          {/* Top tab navigation within the page */}
          <div className={styles.tabNav}>
            <button
              className={`${styles.tabBtn} ${
                activeTab === 'logs' ? styles.active : ''
              }`}
              onClick={() => setActiveTab('logs')}
            >
              <span className={styles.tabText}>Logs</span>
            </button>
            <button
              className={`${styles.tabBtn} ${
                activeTab === 'analytics' ? styles.active : ''
              }`}
              onClick={() => setActiveTab('analytics')}
            >
              <span className={styles.tabText}>Analytics</span>
            </button>
            <button
              className={`${styles.tabBtn} ${
                activeTab === 'predictions' ? styles.active : ''
              }`}
              onClick={() => setActiveTab('predictions')}
            >
              <span className={styles.tabText}>Predictions</span>
            </button>
            <button
              className={`${styles.tabBtn} ${
                activeTab === 'planner' ? styles.active : ''
              }`}
              onClick={() => setActiveTab('planner')}
            >
              <span className={styles.tabText}>Planner</span>
            </button>
          </div>

          <div className={styles.contentArea}>
            {activeTab === 'logs' && (
              <div className={wasteStyles.logsMainWrapper}>

                <div className={wasteStyles.entryFormContainer}>
                  <h3>New Entry</h3>

                  <form onSubmit={handleSubmitWaste} className={wasteStyles.entryForm}>

                    <div className={wasteStyles.formGroup}>
                      <label>Item Name</label>
                      <input
                        type="text"
                        value={wasteForm.itemName}
                        onChange={(e) =>
                          setWasteForm({ ...wasteForm, itemName: e.target.value })
                        }
                        placeholder="Example: Croissant"
                        required
                      />
                    </div>

                    <div className={wasteStyles.formRow2}>
                      <div className={wasteStyles.formGroup}>
                        <label>Category</label>
                        <select
                          value={wasteForm.category}
                          onChange={(e) =>
                            setWasteForm({ ...wasteForm, category: e.target.value })
                          }
                        >
                          <option value="meal">Meal</option>
                          <option value="snack">Snack</option>
                          <option value="bakery">Bakery</option>
                          <option value="beverages">Beverages</option>
                          <option value="desserts">Desserts</option>
                          <option value="sides">Sides</option>
                        </select>
                      </div>

                      <div className={wasteStyles.formGroup}>
                        <label>Date</label>
                        <input
                          type="date"
                          value={wasteForm.date}
                          onChange={(e) =>
                            setWasteForm({ ...wasteForm, date: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className={wasteStyles.formRow3}>
                      <div className={wasteStyles.formGroup}>
                        <label>Prepared</label>
                        <input
                          type="number"
                          value={wasteForm.preparedQuantity}
                          onChange={(e) => {
                            const prepared = Number(e.target.value);
                            const sold = Number(wasteForm.soldQuantity);

                            if (sold > prepared) {
                              showToast("error", "Invalid", "Sold cannot exceed prepared");
                              return;
                            }

                            setWasteForm({
                              ...wasteForm,
                              preparedQuantity: prepared,
                              wastedQuantity: prepared - sold,
                            });
                          }}
                          required
                        />
                      </div>

                      <div className={wasteStyles.formGroup}>
                        <label>Sold</label>
                        <input
                          type="number"
                          value={wasteForm.soldQuantity}
                          onChange={(e) => {
                            const sold = Number(e.target.value);
                            const prepared = Number(wasteForm.preparedQuantity);

                            if (sold > prepared) {
                              showToast("error", "Invalid", "Sold cannot exceed prepared");
                              return;
                            }

                            setWasteForm({
                              ...wasteForm,
                              soldQuantity: sold,
                              wastedQuantity: prepared - sold,
                            });
                          }}
                          required
                        />
                      </div>

                      <div className={wasteStyles.formGroup}>
                        <label>Waste (Auto)</label>
                        <input type="number" value={wasteForm.wastedQuantity || 0} readOnly />
                      </div>
                    </div>

                    <div className={wasteStyles.formRow2}>

                      <div className={wasteStyles.formGroup}>
                        <label>Meal Period (Optional)</label>
                        <select
                          value={wasteForm.mealPeriod}
                          onChange={(e) =>
                            setWasteForm({ ...wasteForm, mealPeriod: e.target.value })
                          }
                        >
                          <option value="all-day">All Day</option>
                          <option value="breakfast">Breakfast</option>
                          <option value="lunch">Lunch</option>
                          <option value="dinner">Dinner</option>
                        </select>
                      </div>

                      <div className={wasteStyles.formGroup}>
                        <label>Weather (Optional)</label>
                        <select
                          value={wasteForm.weather}
                          onChange={(e) =>
                            setWasteForm({ ...wasteForm, weather: e.target.value })
                          }
                        >
                          <option value="sunny">Sunny</option>
                          <option value="cloudy">Cloudy</option>
                          <option value="rainy">Rainy</option>
                          <option value="snowy">Snowy</option>
                        </select>
                      </div>
                    </div>

                    <div className={wasteStyles.formRow2}>
                      <div className={wasteStyles.formGroup}>
                        <label className={wasteStyles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={wasteForm.specialEvent}
                            onChange={(e) =>
                              setWasteForm({ ...wasteForm, specialEvent: e.target.checked })
                            }
                          />
                          Special Event Day
                        </label>
                      </div>

                      <div className={wasteStyles.formGroup}>
                        <label>Revenue (£, Optional)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={wasteForm.revenue}
                          onChange={(e) =>
                            setWasteForm({ ...wasteForm, revenue: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <button type="submit" className={wasteStyles.btnSubmit}>
                      Save Entry
                    </button>
                  </form>
                </div>


                <div className={wasteStyles.logsContainer}>
                  <h3>Logs by Week</h3>

                  <div className={wasteStyles.logsScroll}>
                    {weeklyLogs.map((week, index) => (
                      <div key={index} className={wasteStyles.weekCard}>
                        <div
                          className={wasteStyles.weekHeader}
                          onClick={() =>
                            setWeeklyLogs((prev) =>
                              prev.map((w, i) =>
                                i === index ? { ...w, open: !w.open } : w
                              )
                            )
                          }
                        >
                          <span>▸ {week.weekStart.toLocaleDateString()} – {week.weekEnd.toLocaleDateString()}</span>
                          <span className={wasteStyles.weekBadge}>{week.logs.length}</span>
                        </div>

                        {week.open && (
                          <div className={wasteStyles.weekBody}>
                            {week.logs.map((log) => (
                              <div key={log._id} className={wasteStyles.logRow}>
                                <div className={wasteStyles.logDate}>
                                  {new Date(log.date).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                  })}
                                </div>

                                <div className={wasteStyles.logItem}>{log.itemName}</div>
                                <div className={wasteStyles.logCategory}>{log.category}</div>

                                <div className={wasteStyles.logQty}>
                                  <span title="Prepared">P:{log.preparedQuantity} </span>
                                  <span title="Sold">S:{log.soldQuantity} </span>
                                  <span title="Wasted">W:{log.wastedQuantity} </span>
                                </div>

                                <div
                                  className={`${wasteStyles.logWasteTag} ${
                                    log.wastePercentage > 30
                                      ? wasteStyles.high
                                      : log.wastePercentage > 15
                                      ? wasteStyles.medium
                                      : wasteStyles.low
                                  }`}
                                >
                                  {log.wastePercentage?.toFixed(1)}%
                                </div>

                                <button
                                  className={wasteStyles.logDeleteBtn}
                                  onClick={() => handleDeleteLog(log._id)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && analytics && (
              <div className={wasteStyles.analyticsContainer}>
                <div className={wasteStyles.metricsGrid}>
                  <div className={wasteStyles.metric}>
                    <span>Total Prepared</span>
                    <strong>{analytics.summary.totalPrepared}</strong>
                  </div>
                  <div className={wasteStyles.metric}>
                    <span>Total Sold</span>
                    <strong>{analytics.summary.totalSold}</strong>
                  </div>
                  <div className={wasteStyles.metric}>
                    <span>Total Wasted</span>
                    <strong>{analytics.summary.totalWasted}</strong>
                  </div>
                  <div className={wasteStyles.metric}>
                    <span>Average Waste</span>
                    <strong>
                      {analytics.summary.avgWastePercentage?.toFixed(1)}%
                    </strong>
                  </div>
                  <div className={wasteStyles.metric}>
                    <span>Revenue Loss</span>
                    <strong>
                      £{analytics.summary.totalRevenueLoss?.toFixed(2)}
                    </strong>
                  </div>
                </div>

                {analytics.topWastedItems &&
                  analytics.topWastedItems.length > 0 && (
                    <div className={wasteStyles.topItems}>
                      <h3>Top Wasted Items</h3>
                      {analytics.topWastedItems.map((item, i) => (
                        <div key={i} className={wasteStyles.topItem}>
                          <div className={wasteStyles.rank}>{i + 1}</div>
                          <div className={wasteStyles.details}>
                            <div>{item._id}</div>
                            <div className={wasteStyles.stats}>
                              {item.totalWasted} units •{' '}
                              {item.avgWastePercentage?.toFixed(1)}%
                            </div>
                          </div>
                          <div className={wasteStyles.loss}>
                            £{item.potentialRevenueLoss?.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {activeTab === 'predictions' && (
              <div className={wasteStyles.predictContainer}>
                <div className={wasteStyles.predictForm}>
                  <h3>Smart Quantity Recommendation</h3>

                  {/* Item selection + date for recommendation */}
                  <div className={wasteStyles.formRow2}>
                    <div className={wasteStyles.formGroup}>
                      <label>Item Name</label>
                      <input
                        type="text"
                        value={itemNameInput}
                        onChange={(e) => setItemNameInput(e.target.value)}
                        placeholder="e.g. Croissant"
                        list="item-suggestions"
                      />
                      <datalist id="item-suggestions">
                        {uniqueItems.map(item => (
                          <option key={item} value={item} />
                        ))}
                      </datalist>
                    </div>
                    <div className={wasteStyles.formGroup}>
                      <label>Date for Recommendation</label>
                      <input
                        type="date"
                        value={suggestionDate}
                        onChange={(e) => setSuggestionDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Single action button */}
                  <button
                    onClick={fetchSmartSuggestion}
                    className={wasteStyles.btnPrimary}
                    style={{ width: '100%', marginTop: '1rem' }}
                  >
                    Get Recommendation
                  </button>

                  {/* ML-backed suggestion display */}
                  {suggestions && suggestions.hasData && (
                    <div className={wasteStyles.suggBox}>
                      <h4>Recommendation for {suggestionDate}</h4>
                      <div className={wasteStyles.suggRow}>
                        <span>Prepare:</span>
                        <span
                          style={{
                            fontSize: '1.5em',
                            color: '#2ecc71'
                          }}
                        >
                          <strong>{suggestions.recommended} units</strong>
                        </span>
                      </div>
                      <div className={wasteStyles.suggRow}>
                        <span>Historical Average Sold:</span>
                        <span>{suggestions.metrics.historicalAvgSold} units</span>
                      </div>
                      <div className={wasteStyles.suggRow}>
                        <span>Peak Demand:</span>
                        <span>{suggestions.metrics.peakDemand} units</span>
                      </div>
                      <div className={wasteStyles.suggRow}>
                        <span>ML Predicted Waste:</span>
                        <span>{suggestions.metrics.mlPredictedWaste}%</span>
                      </div>
                      <div className={wasteStyles.suggRow}>
                        <span>Confidence:</span>
                        <span>{suggestions.confidence}</span>
                      </div>
                      <div
                        className={wasteStyles.note}
                        style={{ marginTop: '12px', fontSize: '0.9em' }}
                      >
                        {suggestions.reasoning}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'planner' && (
              <div className={wasteStyles.plannerContainer}>
                <div className={wasteStyles.plannerHeader}>
                  <h3>Action Planner</h3>
                  <div className={wasteStyles.plannerControls}>
                    <input
                      type="date"
                      value={bulkPredictionDate}
                      onChange={(e) => setBulkPredictionDate(e.target.value)}
                    />
                    <button
                      onClick={handleBulkPredictions}
                      className={wasteStyles.btnPrimary}
                      disabled={loading}
                    >
                      {loading ? 'Generating...' : 'Generate'}
                    </button>
                    {bulkSuggestions && bulkSuggestions.length > 0 && (
                      <button
                        onClick={exportBulkPredictionsPDF}
                        className={wasteStyles.btnSecondary}
                      >
                        Export CSV
                      </button>
                    )}
                  </div>
                </div>

                {bulkSuggestions && bulkSuggestions.length > 0 && (
                  <div className={wasteStyles.plannerTable}>
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th>Hist Avg</th>
                          <th>Peak</th>
                          <th>Recommended</th>
                          <th>Waste</th>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkSuggestions.map((rec, i) => (
                          <tr key={i}>
                            <td>{rec.itemName}</td>
                            <td>{rec.category}</td>
                            <td>{rec.avgHistorical}</td>
                            <td>{rec.peakDemand}</td>
                            <td>
                              <strong
                                style={{
                                  color: '#2ecc71',
                                  fontSize: '1.1em'
                                }}
                              >
                                {rec.recommended}
                              </strong>
                            </td>
                            <td
                              className={
                                parseFloat(rec.predictedWaste) > 20
                                  ? wasteStyles.high
                                  : parseFloat(rec.predictedWaste) > 10
                                  ? wasteStyles.medium
                                  : wasteStyles.low
                              }
                            >
                              {rec.predictedWaste}%
                            </td>
                            <td>{rec.confidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <MobileBottomNav
          currentPage="waste"
          onTabNavigation={(path) => navigate(path)}
        />
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className={wasteStyles.toastContainer}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`${wasteStyles.toast} ${wasteStyles[toast.type]}`}
            >
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WastePrediction;

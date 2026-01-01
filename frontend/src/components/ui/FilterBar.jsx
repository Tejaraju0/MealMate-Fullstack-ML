// components/ui/FilterBar.jsx
import React from 'react';
import styles from '../../css/MyPosts.module.css';

const FilterBar = ({
  searchTerm,
  onSearchChange,
  filters = [],
  selectedFilter,
  onFilterChange,
  searchPlaceholder = "Search..."
}) => {
  return (
    <div className={styles.filterBar}>
      <div className={styles.searchSection}>
        <input 
          type="text" 
          className={styles.searchInput} 
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className={styles.statusFilters}>
        {filters.map(filter => (
          <button
            key={filter.key}
            className={`${styles.filterChip} ${selectedFilter === filter.key ? styles.active : ''}`}
            onClick={() => onFilterChange(filter.key)}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilterBar;
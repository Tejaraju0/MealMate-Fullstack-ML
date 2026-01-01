import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import r2_score
import pickle
import os

def load_prepared_data(data_dir):

    X = pd.read_csv(os.path.join(data_dir, 'X_features.csv'))
    y = pd.read_csv(os.path.join(data_dir, 'y_target.csv')).values.ravel()
    return X, y

def test_multiple_seeds(X, y, num_seeds=10):

    seeds = [42, 123, 456, 789, 1011, 1213, 1415, 1617, 1819, 2021][:num_seeds]
    results = []
    
    
    for seed in seeds:
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=seed, shuffle=True
        )
        
        
        model = GradientBoostingRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.08,
            min_samples_split=10,
            min_samples_leaf=5,
            subsample=0.9,
            random_state=42  
        )
        
        model.fit(X_train, y_train)
        
        
        train_r2 = r2_score(y_train, model.predict(X_train))
        test_r2 = r2_score(y_test, model.predict(X_test))
        results.append({
            'seed': seed,
            'train_r2': train_r2,
            'test_r2': test_r2
        })
        
        print(f"Seed {seed:4d}: Train R²={train_r2:.4f}, Test R²={test_r2:.4f}")
    
    
    test_r2_values = [r['test_r2'] for r in results]
    mean_r2 = np.mean(test_r2_values)
    std_r2 = np.std(test_r2_values)
    min_r2 = np.min(test_r2_values)
    max_r2 = np.max(test_r2_values)
    
    print("="*60)
    print(f"Mean R²:     {mean_r2:.4f}")
    print(f"Std Dev:     {std_r2:.4f}")
    print(f"Min R²:      {min_r2:.4f}")
    print(f"Max R²:      {max_r2:.4f}")
    print(f"Range:       [{min_r2:.4f} - {max_r2:.4f}]")
    print(f"\nReport as: R² = {mean_r2:.3f} ± {std_r2:.3f}")
    print("="*60)
    
    
    if std_r2 < 0.03:
        print(" EXCELLENT: Low variance")
    elif std_r2 < 0.06:
        print(" GOOD: Acceptable variance")
    else:
        print(" WARNING: High variance")
    
    return results, mean_r2, std_r2

def main():
    data_dir = 'data/prepared'
    
    print("Multi-Seed Reproducibility Test")
    
    
    X, y = load_prepared_data(data_dir)
    
    
    results, mean_r2, std_r2 = test_multiple_seeds(X, y, num_seeds=10)
    
    
    output_dir = 'models/validation'
    os.makedirs(output_dir, exist_ok=True)
    
    import pandas as pd
    results_df = pd.DataFrame(results)
    results_df.to_csv(os.path.join(output_dir, 'multi_seed_results.csv'), index=False)

if __name__ == "__main__":
    main()
from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import numpy as np
from sklearn.naive_bayes import GaussianNB, CategoricalNB
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, confusion_matrix
import io
import json
import math

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        file = request.files.get('file')
        if not file:
            return jsonify({'error': 'No file uploaded'}), 400

        df = pd.read_csv(file)
        if df.shape[1] < 2:
            return jsonify({'error': 'Dataset must have at least 2 columns'}), 400

        feature_names = list(df.columns[:-1])
        target_name = df.columns[-1]

        X_raw = df.iloc[:, :-1]
        y_raw = df.iloc[:, -1]

        # Encode categorical columns
        encoders = {}
        X_encoded = X_raw.copy()
        for col in X_raw.columns:
            if X_raw[col].dtype == object:
                le = LabelEncoder()
                X_encoded[col] = le.fit_transform(X_raw[col].astype(str))
                encoders[col] = le

        y_encoder = LabelEncoder()
        y = y_encoder.fit_transform(y_raw.astype(str))
        classes = list(y_encoder.classes_)

        X = X_encoded.values.astype(float)

        # Train model
        model = GaussianNB()
        model.fit(X, y)
        predictions_encoded = model.predict(X)
        predictions = list(y_encoder.inverse_transform(predictions_encoded))
        proba = model.predict_proba(X)

        accuracy = float(accuracy_score(y, predictions_encoded))
        cm = confusion_matrix(y, predictions_encoded).tolist()

        # Compute step-by-step for small datasets
        steps = []
        class_counts = {}
        total = len(y)
        for cls_idx, cls_name in enumerate(classes):
            count = int(np.sum(y == cls_idx))
            class_counts[cls_name] = {
                'count': count,
                'prior': round(count / total, 4)
            }

        steps.append({
            'title': 'Step 1: Prior Probabilities',
            'data': class_counts
        })

        # Pre-calculate Gaussian parameters with smoothing (identical to sklearn's GaussianNB)
        # var_smoothing default is 1e-9. epsilon is 1e-9 * max variance of all features.
        var_smoothing = 1e-9
        max_var = np.var(X, axis=0).max() if X.shape[0] > 0 else 0
        epsilon = var_smoothing * max_var

        likelihoods = {}
        # Pre-calculated stats for Step 3 to ensure consistency
        class_stats = {} 

        for cls_idx, cls_name in enumerate(classes):
            X_cls = X[y == cls_idx]
            likelihoods[cls_name] = {}
            class_stats[cls_idx] = {}
            
            for fi, fname in enumerate(feature_names):
                mean = float(np.mean(X_cls[:, fi])) if X_cls.shape[0] > 0 else 0
                # var = mean of squared deviations + epsilon
                variance = float(np.var(X_cls[:, fi])) if X_cls.shape[0] > 0 else 0
                smoothed_var = variance + epsilon
                sigma = float(np.sqrt(smoothed_var))
                
                likelihoods[cls_name][fname] = {'mean': round(mean, 4), 'std': round(sigma, 4)}
                class_stats[cls_idx][fi] = {'mean': mean, 'sigma': sigma, 'var': smoothed_var}

        steps.append({
            'title': 'Step 2: Gaussian Likelihood Parameters (Mean & Std per Class)',
            'data': likelihoods
        })

        # Per-sample detailed calculations (limit to first 20 for performance)
        sample_calculations = []
        num_detail = min(len(X), 20)
        for si in range(num_detail):
            sample_calc = {
                'index': si + 1,
                'features': {feature_names[j]: float(X[si, j]) for j in range(len(feature_names))},
                'feature_labels': {feature_names[j]: str(X_raw.iloc[si, j]) for j in range(len(feature_names))},
                'class_calcs': {}
            }
            for cls_idx, cls_name in enumerate(classes):
                prior_val = class_counts[cls_name]['prior']
                likelihood_parts = []
                log_product = math.log(prior_val)
                for fi, fname in enumerate(feature_names):
                    x_val = float(X[si, fi])
                    stats = class_stats[cls_idx][fi]
                    mu = stats['mean']
                    sigma = stats['sigma']
                    var = stats['var']
                    
                    # Gaussian PDF: (1 / sqrt(2*pi*var)) * exp(-(x-mu)^2 / (2*var))
                    pdf = float((1 / (np.sqrt(2 * np.pi) * sigma)) * np.exp(-((x_val - mu)**2) / (2 * var)))
                    log_product += math.log(pdf + 1e-12)
                    likelihood_parts.append({
                        'feature': fname,
                        'x': round(x_val, 4),
                        'mean': round(mu, 4),
                        'std': round(sigma, 4),
                        'pdf': round(pdf, 6)
                    })
                sample_calc['class_calcs'][cls_name] = {
                    'prior': round(prior_val, 4),
                    'likelihoods': likelihood_parts,
                    'log_posterior': round(log_product, 6)
                }

            # Normalize using log-sum-exp trick for numerical stability
            log_posteriors = [v['log_posterior'] for v in sample_calc['class_calcs'].values()]
            max_log = max(log_posteriors)
            
            # exp(log_p - max_log) for each class
            exp_vals = {cls: math.exp(v['log_posterior'] - max_log) 
                        for cls, v in sample_calc['class_calcs'].items()}
            sum_exp = sum(exp_vals.values())
            
            # Use remainder adjustment to ensure sum is exactly 1.0 (100%)
            current_sum = 0
            for i, cls_name in enumerate(classes):
                if i < len(classes) - 1:
                    val = round(exp_vals[cls_name] / sum_exp, 4) if sum_exp > 0 else 0
                    sample_calc['class_calcs'][cls_name]['normalized'] = val
                    current_sum += val
                else:
                    # Final class takes the remainder to ensure exact 100% total
                    remainder = round(1.0 - current_sum, 4)
                    sample_calc['class_calcs'][cls_name]['normalized'] = max(0, remainder)

            predicted_cls = max(sample_calc['class_calcs'],
                                key=lambda c: sample_calc['class_calcs'][c]['log_posterior'])
            sample_calc['predicted'] = predicted_cls
            sample_calc['actual'] = str(y_raw.iloc[si])
            sample_calculations.append(sample_calc)

        steps.append({
            'title': 'Step 3: Posterior = Prior × Likelihood (Detailed Per-Sample Calculations)',
            'data': 'detailed_calculations',
            'calculations': sample_calculations
        })

        steps.append({
            'title': 'Step 4: Prediction = argmax P(C|X)',
            'data': f'Model achieved {round(accuracy*100, 2)}% accuracy on training data.'
        })

        # Build result rows
        result_rows = []
        for i in range(len(df)):
            # Normalize sklearn proba to ensure exactly 1.0 sum after rounding
            raw_probs = [float(proba[i][j]) for j in range(len(classes))]
            current_sum = 0
            rounded_probs = {}
            for j, cls_name in enumerate(classes):
                if j < len(classes) - 1:
                    val = round(raw_probs[j], 4)
                    rounded_probs[cls_name] = val
                    current_sum += val
                else:
                    rounded_probs[cls_name] = round(1.0 - current_sum, 4)

            row = {
                'index': i + 1,
                'features': {feature_names[j]: str(X_raw.iloc[i, j]) for j in range(len(feature_names))},
                'actual': str(y_raw.iloc[i]),
                'predicted': str(predictions[i]),
                'correct': str(y_raw.iloc[i]) == str(predictions[i]),
                'probabilities': rounded_probs
            }
            result_rows.append(row)

        return jsonify({
            'success': True,
            'accuracy': round(accuracy * 100, 2),
            'classes': classes,
            'feature_names': feature_names,
            'target_name': target_name,
            'steps': steps,
            'results': result_rows,
            'confusion_matrix': cm,
            'total_samples': total
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/download-sample')
def download_sample():
    sample_data = """Outlook,Temperature,Humidity,Wind,Play
Sunny,Hot,High,Weak,No
Sunny,Hot,High,Strong,No
Overcast,Hot,High,Weak,Yes
Rainy,Mild,High,Weak,Yes
Rainy,Cool,Normal,Weak,Yes
Rainy,Cool,Normal,Strong,No
Overcast,Cool,Normal,Strong,Yes
Sunny,Mild,High,Weak,No
Sunny,Cool,Normal,Weak,Yes
Rainy,Mild,Normal,Weak,Yes
Sunny,Mild,Normal,Strong,Yes
Overcast,Mild,High,Strong,Yes
Overcast,Hot,Normal,Weak,Yes
Rainy,Mild,High,Strong,No"""
    
    output = io.BytesIO()
    output.write(sample_data.encode())
    output.seek(0)
    return send_file(output, mimetype='text/csv', as_attachment=True, download_name='sample_dataset.csv')


if __name__ == '__main__':
    app.run(debug=True)

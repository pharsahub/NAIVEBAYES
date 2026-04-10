# Naive Bayes Virtual Lab

A complete interactive Virtual Lab for demonstrating the Naive Bayes classifier.

## Project Structure

```
naive-bayes-project/
├── app.py                  ← Flask backend
├── templates/
│   └── index.html          ← Main webpage
├── static/
│   ├── style.css           ← All styles
│   └── script.js           ← Frontend logic
├── dataset/
│   └── sample.csv          ← Sample Play Tennis dataset
└── README.md
```

## Setup & Run

### 1. Install dependencies

```bash
pip install flask pandas scikit-learn numpy
```

### 2. Run the Flask server

```bash
cd naive-bayes-project
python app.py
```

### 3. Open in browser

```
http://localhost:5000
```

## Features

- **Learn Section** — Full concept explanation with Bayes theorem, worked example (Play Tennis), types of NB
- **Video Section** — Embedded YouTube lecture on Naive Bayes
- **Lab Section** — Upload any CSV → runs GaussianNB → shows step-by-step results
- **References** — Academic sources (sklearn docs, Bishop, Mitchell, Wikipedia)
- **Help Section** — Dataset format guide, usage instructions
- **Developed By** — Student info section
- **Download Button** — Downloads sample CSV
- **Demo Mode** — Auto-loads and runs without uploading

## Dataset Format

Your CSV must have features in all columns except the last, which is the label:

```
Feature1,Feature2,...,Label
value1,value2,...,classA
value3,value4,...,classB
```

Both numeric and categorical values are supported (categorical values are label-encoded automatically).

## Output

- Accuracy score
- Step-by-step: Prior probabilities → Likelihoods → Posterior → Prediction
- Confusion matrix
- Per-sample probability bars
- Full prediction table with ✔/✘ per row

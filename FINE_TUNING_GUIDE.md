# Kridha — Nova Micro Fine-Tuning Guide

## What This Does

The fine-tuned Nova Micro model generates **headline + pinch** (the stylist voice) for every garment evaluation. This is in the production response path — every user sees output from this model.

**Architecture:**
```
User + Garment → Scoring Engine (deterministic, instant)
                      ↓
               Score Result + Profiles
                      ↓
              Nova Micro (fine-tuned) → headline + pinch  ← THIS IS WHAT WE'RE TRAINING
                      ↓
              Deterministic functions → verdict, goal chips, search pills, etc.
                      ↓
              Guardrails check → body-safe language validation
                      ↓
              UI-ready JSON
```

The phrase bank (`engine/gold_generator.py`) was used to generate the training data. Once Nova Micro is fine-tuned, it replaces the phrase bank in production — giving varied, natural-sounding output instead of templated responses.

---

## Prerequisites

- AWS account with Bedrock access in `us-east-1` (Nova fine-tuning is only available in us-east-1)
- AWS CLI configured (`aws configure`)
- An S3 bucket in `us-east-1`
- IAM role for Bedrock (see Step 2)

---

## Step 1: Clone and Verify Training Data

```bash
git clone git@github.com:kridha-admin/stydev.git
cd stydev
```

Training data is pre-built and validated:

| File | Lines | Format | Use |
|------|-------|--------|-----|
| `engine/training_data.jsonl` | 1,085 | Bedrock Nova | Fine-tuning input |
| `engine/training_data_claude.jsonl` | 1,037 | OpenAI-compatible | Backup/alternative |

All 1,085 examples pass guardrails (0 blocks, 0 warnings).

Verify the format:
```bash
head -1 engine/training_data.jsonl | python3 -m json.tool | head -5
```

Should show:
```json
{
    "schemaVersion": "bedrock-conversation-2024",
    "system": [
        {
            "text": "You are Kridha — a smart best friend..."
```

Each record has:
- `schemaVersion`: `"bedrock-conversation-2024"` (required by Nova)
- `system`: The Kridha voice spec (body-safe language rules, tone, output format)
- `messages[0]` (user): Scoring breakdown with verdict, body shape, garment details, principle scores
- `messages[1]` (assistant): JSON with `headline` + `pinch` array

---

## Step 2: IAM Role Setup

Create a role that Bedrock can assume for the fine-tuning job.

**Trust policy** (`bedrock-trust-policy.json`):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "bedrock.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

**Create the role:**
```bash
aws iam create-role \
    --role-name KridhaBedrockFineTuning \
    --assume-role-policy-document file://bedrock-trust-policy.json
```

**Attach S3 access policy** (`bedrock-s3-policy.json`) — replace `YOUR-BUCKET`:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket",
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET",
                "arn:aws:s3:::YOUR-BUCKET/*"
            ]
        }
    ]
}
```

```bash
aws iam put-role-policy \
    --role-name KridhaBedrockFineTuning \
    --policy-name S3Access \
    --policy-document file://bedrock-s3-policy.json
```

Note the role ARN (format: `arn:aws:iam::ACCOUNT_ID:role/KridhaBedrockFineTuning`).

---

## Step 3: Upload Training Data to S3

```bash
aws s3 cp engine/training_data.jsonl s3://YOUR-BUCKET/kridha/training_data.jsonl
```

---

## Step 4: Create the Fine-Tuning Job

### Option A: AWS Console (Recommended for First Time)

1. Open **Amazon Bedrock** console → Region: **us-east-1**
2. Left nav → **Custom models** → **Create Fine-tuning job**
3. Fill in:
   - **Fine-tuning job name:** `kridha-nova-micro-v1`
   - **Custom model name:** `kridha-stylist-v1`
   - **Select model** → Provider: **Amazon** → Model: **Nova Micro**
   - **IAM role:** Select `KridhaBedrockFineTuning`
   - **Training data S3 URI:** `s3://YOUR-BUCKET/kridha/training_data.jsonl`
   - **Output S3 URI:** `s3://YOUR-BUCKET/kridha/output/`
4. **Hyperparameters:**
   - **Epochs:** `3` (for 1085 examples, 3 is a good starting point. AWS caps at 5.)
   - **Learning rate warmup steps:** `2` (formula: dataset_size / 640 = 1085/640 ≈ 2)
   - **Learning rate:** leave default (Nova Micro can handle a slightly larger LR — default is fine for first run)
5. Click **Create**

### Option B: AWS CLI

```bash
aws bedrock create-model-customization-job \
    --region us-east-1 \
    --customization-type FINE_TUNING \
    --base-model-identifier amazon.nova-micro-v1:0 \
    --role-arn arn:aws:iam::ACCOUNT_ID:role/KridhaBedrockFineTuning \
    --job-name kridha-nova-micro-v1 \
    --custom-model-name kridha-stylist-v1 \
    --training-data-config '{"s3Uri": "s3://YOUR-BUCKET/kridha/training_data.jsonl"}' \
    --output-data-config '{"s3Uri": "s3://YOUR-BUCKET/kridha/output/"}' \
    --hyper-parameters '{"epochCount": "3", "learningRateWarmupSteps": "2"}'
```

---

## Step 5: Monitor the Job

```bash
# Check status
aws bedrock get-model-customization-job \
    --region us-east-1 \
    --job-identifier kridha-nova-micro-v1

# List all jobs
aws bedrock list-model-customization-jobs --region us-east-1
```

Status progression: `InProgress` → `Completed` (or `Failed`)

Expected time: **1-3 hours** for 1085 examples on Nova Micro.

When done, check training metrics in the S3 output folder.

---

## Step 6: Deploy the Model

Fine-tuned models need provisioned throughput to be invocable.

```bash
aws bedrock create-provisioned-model-throughput \
    --region us-east-1 \
    --model-units 1 \
    --provisioned-model-name kridha-stylist-v1-pt \
    --model-id kridha-stylist-v1
```

This returns a provisioned model ARN like:
```
arn:aws:bedrock:us-east-1:ACCOUNT_ID:provisioned-model/kridha-stylist-v1-pt
```

**That ARN is what you use to invoke the model.**

**Cost note:** Provisioned throughput has an ongoing hourly cost. Delete it when not actively testing:
```bash
aws bedrock delete-provisioned-model-throughput \
    --provisioned-model-id kridha-stylist-v1-pt
```

---

## Step 7: Test the Model

### Quick test via CLI:

```bash
aws bedrock-runtime invoke-model \
    --region us-east-1 \
    --model-id arn:aws:bedrock:us-east-1:ACCOUNT_ID:provisioned-model/kridha-stylist-v1-pt \
    --content-type application/json \
    --body '{
        "schemaVersion": "bedrock-conversation-2024",
        "system": [{"text": "You are Kridha..."}],
        "messages": [
            {"role": "user", "content": [{"text": "VERDICT: this_is_it\nSCORE: 8.5/10\n\nGARMENT: Black Wrap Dress\n  Category: dress\n\nUSER:\n  Height: 5'\''6\"\n  Body shape: hourglass\n  Goals: highlight_waist\n\nSCORING BREAKDOWN:\n  Waist Definition: +0.35 (strong positive)\n\nGenerate the headline and pinch for this garment. Return valid JSON only."}]}
        ],
        "inferenceConfig": {"maxTokens": 500, "temperature": 0.7}
    }' \
    output.json

cat output.json | python3 -m json.tool
```

### Validate output through guardrails:

```bash
cd stydev
python3 -c "
import json
from engine.guardrails import check_output

# Parse the model output
with open('output.json') as f:
    resp = json.load(f)

text = resp['output']['message']['content'][0]['text']
output = json.loads(text)

# Run guardrails
result = check_output({
    'verdict': 'this_is_it',
    'headline': output['headline'],
    'pinch': output['pinch'],
})
print('Passed:', result.passed)
for v in result.violations:
    print(f'  BLOCK: {v.rule} — {v.text}')
for w in result.warnings:
    print(f'  WARN: {w.rule} — {w.text}')
"
```

---

## Step 8: Validate at Scale

Run the full validation suite against the fine-tuned model to check guardrail pass rates before going live:

```bash
python3 -m engine.validate_guardrails
```

Target: **0 blocks, 100% pass rate**. The training data already passes at 100%, so the model should maintain this.

---

## Hyperparameter Tuning Tips

If results aren't great on first run:

| Problem | Fix |
|---------|-----|
| Output too generic / doesn't match voice | Increase epochs to 5 |
| Output too repetitive / overfitting | Reduce epochs to 2, or duplicate data less |
| Small dataset (<1K) underfitting | Duplicate the JSONL data 2x (effectively doubles epochs past the 5 cap) |
| Guardrail failures in output | Check if model is inventing body-negative language — may need more NTO examples in training data |

**Nova Micro warmup formula:** `warmup_steps = dataset_size / 640`
- For 1085 examples: `1085 / 640 ≈ 2`
- If you duplicate data to 2170: `2170 / 640 ≈ 3`

---

## Regenerating Training Data

If you need to rebuild training data (e.g., after engine changes):

```bash
# Using the local phrase bank (no API calls, instant):
cd stydev
python3 -m engine.training_data_builder -o engine/training_data.jsonl --backend local

# Using Claude as teacher (higher quality, costs API credits):
export ANTHROPIC_API_KEY=sk-ant-...
python3 -m engine.training_data_builder -o engine/training_data.jsonl --backend anthropic
```

---

## Cost Estimate

| Item | Cost |
|------|------|
| Fine-tuning 1085 examples, 3 epochs, Nova Micro | ~$5-15 |
| Provisioned throughput (while testing) | Hourly rate — delete when not using |
| Per-inference (production) | Fraction of a cent per call |

---

## Files Reference

```
engine/
  training_data.jsonl          # 1085 lines, Bedrock Nova format (USE THIS)
  training_data_claude.jsonl   # 1037 lines, OpenAI format (backup)
  training_data_builder.py     # Regenerate training data
  validate_guardrails.py       # Validate phrase bank output through guardrails
  voice_spec.py                # System prompt (Kridha voice + body-safe rules)
  guardrails.py                # 7 body-safe language rules
  gold_generator.py            # Phrase bank (used to generate training data)
  communicate.py               # Production orchestrator (will call Nova Micro)
  scoring_service.py           # FastAPI endpoints
```

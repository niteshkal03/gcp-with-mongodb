#!/bin/bash

PROJECT_ID="project-93292acb-1b2a-49eb-8cd"
GITHUB_ORG="niteshkal03"
REPO_NAME="https://github.com/niteshkal03/gcp-with-mongodb.git"
SERVICE_ACCOUNT="github-actions-sa"

echo "════════════════════════════════════════════════════════"
echo "🔧 Fixing GCP Permissions for GitHub Actions"
echo "════════════════════════════════════════════════════════"

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo ""
echo "📝 Step 1: Enabling APIs..."
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sts.googleapis.com

# Create service account if it doesn't exist
echo ""
echo "📝 Step 2: Creating Service Account..."
if gcloud iam service-accounts describe ${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Service account already exists"
else
    gcloud iam service-accounts create $SERVICE_ACCOUNT \
      --display-name="GitHub Actions Service Account" \
      --project=$PROJECT_ID
    echo "✅ Service account created"
fi

# Add all required roles
echo ""
echo "📝 Step 3: Adding IAM Roles..."

ROLES=(
    "roles/artifactregistry.writer"
    "roles/artifactregistry.admin"
    "roles/run.admin"
    "roles/iam.serviceAccountUser"
    "roles/iam.serviceAccountTokenCreator"
    "roles/serviceusage.serviceUsageConsumer"
)

for ROLE in "${ROLES[@]}"; do
    echo "  Adding $ROLE..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
      --role="$ROLE" \
      --quiet
done

# Create Artifact Registry repository
echo ""
echo "📝 Step 4: Creating Artifact Registry..."
if gcloud artifacts repositories describe cloud-run-repo \
  --location=us-central1 \
  --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Artifact Registry already exists"
else
    gcloud artifacts repositories create cloud-run-repo \
      --repository-format=docker \
      --location=us-central1 \
      --project=$PROJECT_ID
    echo "✅ Artifact Registry created"
fi

# Setup/Verify WIF
echo ""
echo "📝 Step 5: Setting up Workload Identity Federation..."

# Check if pool exists
if gcloud iam workload-identity-pools describe github-pool \
  --project=$PROJECT_ID \
  --location=global &>/dev/null; then
    echo "✅ WIF Pool already exists"
else
    gcloud iam workload-identity-pools create github-pool \
      --project=$PROJECT_ID \
      --location=global \
      --display-name="GitHub Pool"
    echo "✅ WIF Pool created"
fi

# Check if provider exists
if gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool &>/dev/null; then
    echo "✅ WIF Provider already exists"
else
    gcloud iam workload-identity-pools providers create-oidc github-provider \
      --project=$PROJECT_ID \
      --location=global \
      --workload-identity-pool=github-pool \
      --display-name="GitHub Provider" \
      --attribute-mapping="google.subject=assertion.sub,assertion.aud=assertion.aud,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
      --issuer-uri="https://token.actions.githubusercontent.com"
    echo "✅ WIF Provider created"
fi

# Get provider resource name
PROVIDER=$(gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)")

# Create WIF binding
echo ""
echo "📝 Step 6: Creating WIF Binding..."
gcloud iam service-accounts add-iam-policy-binding \
  ${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com \
  --project=$PROJECT_ID \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_ID/locations/global/workloadIdentityPools/github-pool/attribute.repository_owner/$GITHUB_ORG" \
  --quiet

echo "✅ WIF Binding created"

# Verify permissions
echo ""
echo "📝 Step 7: Verifying Permissions..."
echo ""
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT}@*" \
  --format="table(bindings.role)"

# Output summary
echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ All Permissions Fixed!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Update these GitHub Secrets:"
echo ""
echo "WIF_PROVIDER:"
echo "  $PROVIDER"
echo ""
echo "WIF_SERVICE_ACCOUNT:"
echo "  ${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo "GCP_PROJECT_ID:"
echo "  $PROJECT_ID"
echo ""
echo "════════════════════════════════════════════════════════"

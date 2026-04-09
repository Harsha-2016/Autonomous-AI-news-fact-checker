# TruthLens Backend Core - Requirements Document

## Introduction

TruthLens Backend Core is an autonomous AI fact-checking system that verifies user-submitted claims against trusted sources. The system retrieves relevant evidence from curated domains, applies Natural Language Inference (NLI) to assess claim-evidence relationships, and calculates a truth score (1-100) based on weighted NLI verdicts and source reliability. The backend exposes a REST API endpoint that processes verification requests and returns structured results within a 30-second SLA.

## Glossary

- **Claim**: A factual statement submitted by a user for verification
- **Evidence**: Text content retrieved from trusted sources that relates to a claim
- **NLI (Natural Language Inference)**: A machine learning task that determines the relationship between a premise (claim) and hypothesis (evidence) as contradiction, entailment, or neutral
- **NLI_Score**: A normalized score (0.0-1.0) derived from NLI model output: contradiction=0.0, neutral=0.5, entailment=1.0
- **Source_Weight**: A trust score (0.0-1.0) assigned to a domain based on editorial standards and reliability
- **Truth_Score**: A final normalized score (1-100) representing the likelihood that a claim is true
- **Verdict**: A categorical classification (True/False/Uncertain) derived from the truth score
- **Trusted_Domain**: A curated domain from which evidence is retrieved (e.g., reuters.com, bbc.com)
- **Tavily_API**: Third-party search service used to retrieve evidence from trusted domains
- **NLI_Model**: Cross-encoder/nli-deberta-v3-small transformer model for claim-evidence inference
- **FastAPI_Lifespan**: Application lifecycle context manager that initializes and tears down resources
- **TAVILY_API_KEY**: Environment variable containing authentication credentials for Tavily API
- **Domain_Weights**: Mapping of trusted domains to their source reliability scores

## Requirements

### Requirement 1: Accept Claim Verification Requests

**User Story:** As an API consumer, I want to submit a claim for verification, so that I can obtain a truth assessment.

#### Acceptance Criteria

1. WHEN a POST request is received at `/verify` endpoint with a valid JSON payload containing a claim, THE API_Server SHALL accept the request and parse the claim text
2. WHEN the claim text is empty or contains only whitespace, THE API_Server SHALL return a 400 Bad Request error with a descriptive message
3. WHEN the claim text exceeds 5000 characters, THE API_Server SHALL truncate it to 5000 characters and proceed with verification
4. THE API_Server SHALL validate that the request payload conforms to the VerifyRequest schema (claim: string)
5. WHEN a malformed JSON payload is received, THE API_Server SHALL return a 400 Bad Request error with schema validation details

### Requirement 2: Retrieve Evidence from Trusted Sources

**User Story:** As the verification system, I want to search for evidence from curated trusted domains, so that I can base truth assessments on reliable sources.

#### Acceptance Criteria

1. WHEN a claim is submitted, THE Evidence_Retriever SHALL query the Tavily API with the claim text (truncated to 350 characters)
2. THE Evidence_Retriever SHALL restrict Tavily searches to the predefined list of trusted domains: reuters.com, apnews.com, bbc.com, isro.gov.in, rbi.org.in, who.int, snopes.com, wikipedia.org, reddit.com
3. WHEN the Tavily API returns results, THE Evidence_Retriever SHALL extract the following fields from each result: title, url, content, and domain
4. WHEN the Tavily API returns fewer than 5 results, THE Evidence_Retriever SHALL return all available results (minimum 1 result required for verification)
5. WHEN the Tavily API returns more than 5 results, THE Evidence_Retriever SHALL return the top 5 results
6. WHEN the Tavily API fails or returns no results, THE Evidence_Retriever SHALL return an empty list and the system SHALL proceed with a default truth score of 50 (Uncertain)
7. THE Evidence_Retriever SHALL extract the domain from each URL and assign a source weight based on the domain_weights mapping
8. WHEN a domain is not found in the domain_weights mapping, THE Evidence_Retriever SHALL assign a default weight of 0.5

### Requirement 3: Load and Initialize NLI Model at Startup

**User Story:** As the system administrator, I want the NLI model to be loaded once at application startup, so that verification requests are processed efficiently without repeated model loading.

#### Acceptance Criteria

1. WHEN the FastAPI application starts, THE Lifespan_Manager SHALL load the cross-encoder/nli-deberta-v3-small model into memory
2. THE Lifespan_Manager SHALL load the model on CPU device (device="cpu")
3. WHEN the model fails to load, THE Lifespan_Manager SHALL log an error message and set the model reference to None
4. WHEN the model is successfully loaded, THE Lifespan_Manager SHALL store it in the application state (ml_models dictionary)
5. WHEN the application shuts down, THE Lifespan_Manager SHALL release the model from memory and clear the ml_models dictionary
6. THE NLI_Model SHALL be accessible to all verification requests without reloading

### Requirement 4: Load Tavily API Client at Startup

**User Story:** As the system, I want the Tavily API client to be initialized at startup, so that evidence retrieval requests can be processed immediately.

#### Acceptance Criteria

1. WHEN the FastAPI application starts, THE Lifespan_Manager SHALL read the TAVILY_API_KEY from the .env file
2. WHEN TAVILY_API_KEY is present and valid, THE Lifespan_Manager SHALL initialize a TavilyClient instance and store it in the application state
3. WHEN TAVILY_API_KEY is missing or empty, THE Lifespan_Manager SHALL log a warning and set the Tavily_Client reference to None
4. WHEN the Tavily_Client is None, THE Evidence_Retriever SHALL return an empty list for search requests
5. WHEN the application shuts down, THE Lifespan_Manager SHALL release the Tavily_Client from memory

### Requirement 5: Load Domain Trust Scores Configuration

**User Story:** As the system, I want to load domain trust scores from configuration, so that evidence sources are weighted appropriately.

#### Acceptance Criteria

1. WHEN the application starts, THE Configuration_Loader SHALL load the predefined domain weights: reuters.com (0.95), apnews.com (0.95), bbc.com (0.92), isro.gov.in (0.96), rbi.org.in (0.97), who.int (0.93), snopes.com (0.85), wikipedia.org (0.60), reddit.com (0.25)
2. THE Configuration_Loader SHALL attempt to load additional domain weights from `data/domain_trust_scores.json` if it exists
3. WHEN the JSON file exists and is valid, THE Configuration_Loader SHALL merge the loaded weights with predefined weights (loaded weights override predefined)
4. WHEN the JSON file is missing or invalid, THE Configuration_Loader SHALL log a warning and continue with predefined weights only
5. THE Domain_Weights mapping SHALL be accessible to all verification requests

### Requirement 6: Verify Claims Using NLI Model

**User Story:** As the verification system, I want to apply Natural Language Inference to assess claim-evidence relationships, so that I can determine the strength of evidence supporting each claim.

#### Acceptance Criteria

1. WHEN evidence is retrieved for a claim, THE NLI_Verifier SHALL create claim-evidence pairs for each source
2. THE NLI_Verifier SHALL truncate evidence content to 1000 characters before passing to the NLI model
3. WHEN the NLI model processes a claim-evidence pair, THE NLI_Verifier SHALL extract the model's output logits and apply softmax normalization
4. THE NLI_Verifier SHALL map NLI model output labels to scores: label 0 (contradiction) = 0.0, label 1 (entailment) = 1.0, label 2 (neutral) = 0.5
5. THE NLI_Verifier SHALL return an NLI_Score (0.0-1.0) for each claim-evidence pair
6. WHEN the NLI model is unavailable (None), THE NLI_Verifier SHALL return a default score of 0.5 for all pairs

### Requirement 7: Calculate Weighted Truth Score

**User Story:** As the verification system, I want to calculate a final truth score based on weighted NLI verdicts and source reliability, so that users receive a comprehensive assessment.

#### Acceptance Criteria

1. WHEN NLI scores are obtained for all evidence sources, THE Truth_Scorer SHALL calculate the final truth score using the formula: Score = Σ(NLI_Score × Source_Weight) / Total_Sources
2. THE Truth_Scorer SHALL multiply each NLI_Score by its corresponding Source_Weight before summing
3. THE Truth_Scorer SHALL divide the total weighted score by the number of sources to obtain the average
4. THE Truth_Scorer SHALL normalize the result to the range 1-100 by multiplying by 100 and clamping to [1, 100]
5. WHEN no sources are available, THE Truth_Scorer SHALL return a default truth score of 50
6. WHEN the NLI model is unavailable, THE Truth_Scorer SHALL return a default truth score of 50

### Requirement 8: Determine Verdict Classification

**User Story:** As the verification system, I want to classify the truth score into a categorical verdict, so that users receive a clear, actionable assessment.

#### Acceptance Criteria

1. WHEN the truth score is calculated, THE Verdict_Classifier SHALL assign a verdict based on the following thresholds:
   - IF truth_score < 40, THEN verdict = "False"
   - IF truth_score >= 40 AND truth_score <= 65, THEN verdict = "Uncertain"
   - IF truth_score > 65, THEN verdict = "True"
2. THE Verdict_Classifier SHALL return the verdict as a string value

### Requirement 9: Return Verification Results

**User Story:** As an API consumer, I want to receive structured verification results, so that I can display the assessment to users.

#### Acceptance Criteria

1. WHEN verification is complete, THE API_Server SHALL return a VerifyResponse JSON object containing:
   - truth_score (float): The calculated truth score (1-100)
   - verdict (string): The categorical verdict (True/False/Uncertain)
   - supporting_sources (list of strings): URLs of sources used in verification
   - sources (list of objects): Detailed source information including title, url, content, domain, trust_score
   - summary (string): A human-readable summary of the verification result
2. THE API_Server SHALL return HTTP 200 OK with the VerifyResponse payload
3. THE API_Server SHALL serialize all numeric values as floats/integers (not strings)
4. THE API_Server SHALL include all sources used in the calculation in the supporting_sources list

### Requirement 10: Handle API Errors and Edge Cases

**User Story:** As an API consumer, I want clear error messages when verification fails, so that I can understand what went wrong.

#### Acceptance Criteria

1. WHEN the TAVILY_API_KEY is missing, THE API_Server SHALL return HTTP 200 with truth_score=50, verdict="Uncertain", and an empty sources list
2. WHEN the NLI model fails to load, THE API_Server SHALL return HTTP 200 with truth_score=50, verdict="Uncertain", and an empty sources list
3. WHEN the Tavily API request times out (>12 seconds), THE Evidence_Retriever SHALL catch the timeout exception and return an empty list
4. WHEN a malformed URL is encountered in search results, THE Evidence_Retriever SHALL skip that result and continue processing
5. WHEN the claim text is empty after stripping whitespace, THE API_Server SHALL return HTTP 200 with truth_score=50, verdict="Uncertain", and an empty sources list

### Requirement 11: Enforce Response Time SLA

**User Story:** As a system operator, I want verification requests to complete within 30 seconds, so that the API remains responsive.

#### Acceptance Criteria

1. WHEN a verification request is received, THE API_Server SHALL complete the entire verification pipeline (evidence retrieval, NLI inference, score calculation) within 30 seconds
2. THE Tavily API search request SHALL have a timeout of 12 seconds
3. WHEN the Tavily API request exceeds 12 seconds, THE Evidence_Retriever SHALL raise a timeout exception and return an empty list
4. THE NLI model inference SHALL complete within 5 seconds for up to 5 claim-evidence pairs
5. WHEN the total request time approaches 30 seconds, THE API_Server MAY return early with available results

### Requirement 12: Support CORS for Frontend Integration

**User Story:** As a frontend application, I want to make cross-origin requests to the API, so that the UI can communicate with the backend.

#### Acceptance Criteria

1. WHEN a cross-origin request is received, THE API_Server SHALL include CORS headers allowing requests from any origin
2. THE API_Server SHALL allow all HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
3. THE API_Server SHALL allow all request headers
4. THE API_Server SHALL allow credentials in cross-origin requests

### Requirement 13: Provide Backward Compatibility Endpoint

**User Story:** As a legacy frontend application, I want to use the `/api/analyze` endpoint, so that existing integrations continue to work.

#### Acceptance Criteria

1. WHEN a POST request is received at `/api/analyze` endpoint with a JSON payload containing a "text" field, THE API_Server SHALL forward the request to the `/verify` endpoint
2. THE API_Server SHALL return the same VerifyResponse structure as the `/verify` endpoint
3. THE API_Server SHALL map the "text" field from the request to the "claim" field in the VerifyRequest

### Requirement 14: Log Verification Details for Debugging

**User Story:** As a system operator, I want to see detailed logs of the verification process, so that I can debug issues and monitor system behavior.

#### Acceptance Criteria

1. WHEN the NLI model is loaded, THE Lifespan_Manager SHALL log a message indicating successful model initialization
2. WHEN the NLI model fails to load, THE Lifespan_Manager SHALL log an error message with the exception details
3. WHEN evidence is retrieved for each source, THE Truth_Scorer SHALL log the source domain, source weight, and NLI score
4. WHEN the Tavily API fails, THE Evidence_Retriever SHALL log the error message and exception details
5. WHEN the domain_trust_scores.json file cannot be loaded, THE Configuration_Loader SHALL log a warning message

### Requirement 15: Validate Domain Weights Configuration

**User Story:** As the system, I want to ensure domain weights are valid, so that truth scores are calculated correctly.

#### Acceptance Criteria

1. THE Domain_Weights mapping SHALL contain all predefined trusted domains with their specified weights
2. EACH domain weight value SHALL be a float between 0.0 and 1.0 (inclusive)
3. WHEN a domain weight is outside the valid range, THE Configuration_Loader SHALL log a warning and use a default weight of 0.5
4. THE Domain_Weights mapping SHALL be immutable after initialization (read-only during request processing)

### Requirement 16: Handle Concurrent Verification Requests

**User Story:** As the API, I want to process multiple verification requests concurrently, so that the system can handle multiple users simultaneously.

#### Acceptance Criteria

1. THE API_Server SHALL support concurrent request processing using FastAPI's async/await capabilities
2. WHEN multiple verification requests are received simultaneously, THE API_Server SHALL process them in parallel without blocking
3. THE NLI_Model and Tavily_Client instances SHALL be thread-safe and accessible from concurrent requests
4. WHEN concurrent requests access the ml_models dictionary, THE API_Server SHALL ensure thread-safe access

### Requirement 17: Provide API Documentation

**User Story:** As an API consumer, I want to access API documentation, so that I can understand the endpoint contract.

#### Acceptance Criteria

1. WHEN a GET request is received at `/docs`, THE API_Server SHALL return interactive Swagger UI documentation
2. WHEN a GET request is received at `/redoc`, THE API_Server SHALL return ReDoc documentation
3. THE API documentation SHALL include the VerifyRequest and VerifyResponse schemas
4. THE API documentation SHALL include example requests and responses for the `/verify` endpoint


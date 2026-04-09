# Implementation Plan: TruthLens Backend Core

## Overview

This implementation plan breaks down the TruthLens Backend Core feature into sequential, actionable tasks. The system will be built incrementally, starting with project setup and dependencies, then implementing core services, API endpoints, and finally testing and validation. All code will be written in Python using FastAPI framework.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create Python virtual environment and install required packages (FastAPI, Uvicorn, python-dotenv, sentence-transformers, tavily-python)
  - Create main application file with FastAPI app initialization
  - Set up environment variable loading from .env file
  - Configure logging for the application
  - _Requirements: 1.0, 3.0, 4.0, 5.0_

- [x] 2. Implement Configuration Loader service
  - Create configuration_loader.py module with load_domain_weights() function
  - Implement predefined domain weights dictionary with all 9 trusted domains
  - Add logic to load additional weights from data/domain_trust_scores.json if file exists
  - Implement weight validation (0.0-1.0 range) with warning logging for invalid values
  - Return default weight of 0.5 for unknown domains
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 15.1, 15.2, 15.3, 15.4_

- [-] 3. Implement Lifespan Manager for application startup and shutdown
  - Create lifespan context manager using @asynccontextmanager decorator
  - Implement NLI model loading on startup (cross-encoder/nli-deberta-v3-small on CPU device)
  - Add error handling for model load failures with logging
  - Implement Tavily API client initialization from TAVILY_API_KEY environment variable
  - Add error handling for missing/invalid API key with logging
  - Load domain weights configuration during startup
  - Implement resource cleanup on shutdown (clear ml_models, release Tavily client)
  - Store initialized resources in app.state (ml_models, tavily_client, domain_weights)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 5.0_

- [~] 4. Implement Evidence Retriever service
  - Create evidence_retriever.py module with get_ground_truth() async function
  - Implement claim truncation to 350 characters for Tavily API
  - Build include_domains parameter from domain_weights keys
  - Implement Tavily API search with 12-second timeout using asyncio.wait_for()
  - Extract domain from each result URL using urllib.parse
  - Assign source weight from domain_weights mapping (default 0.5 for unknown domains)
  - Limit results to maximum 5 sources
  - Implement error handling for timeout and API failures with logging
  - Return empty list when Tavily client is None or API fails
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 10.3, 11.2, 11.3, 14.5_

- [~] 5. Implement NLI Verifier service
  - Create nli_verifier.py module with calculate_nli_scores() function
  - Implement claim-evidence pair creation for each source
  - Truncate evidence content to 1000 characters before NLI inference
  - Run NLI model inference on each pair
  - Map NLI model output labels to normalized scores (0=0.0, 1=1.0, 2=0.5)
  - Return default score of 0.5 for all pairs when NLI model is None
  - Return list of evidence dictionaries with added nli_score field
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [~] 6. Implement Truth Scorer service
  - Create truth_scorer.py module with calculate_truth_score() function
  - Implement weighted average calculation: Σ(NLI_Score × Source_Weight) / Total_Sources
  - Normalize result to 1-100 range by multiplying by 100 and clamping to [1, 100]
  - Return default score of 50 when no sources available
  - Add debug logging for per-source scoring details (domain, NLI score, weight, weighted score)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [~] 7. Implement Verdict Classifier service
  - Create verdict_classifier.py module with classify_verdict() function
  - Implement threshold logic: <40="False", 40-65="Uncertain", >65="True"
  - Return verdict as string
  - _Requirements: 8.1, 8.2_

- [~] 8. Create data models (VerifyRequest and VerifyResponse)
  - Create models/schemas.py with Pydantic BaseModel classes
  - Implement VerifyRequest with claim field (string, required)
  - Implement VerifyResponse with fields: truth_score (float), verdict (string), supporting_sources (list of strings), sources (list of dicts), summary (string)
  - Add field validation and documentation
  - _Requirements: 1.4, 9.1, 9.3_

- [~] 9. Implement POST /verify endpoint
  - Create verify_claim() async route handler in main.py
  - Implement claim validation (strip whitespace, check for empty)
  - Truncate claim to 5000 characters
  - Call Evidence Retriever to get ground truth
  - Call NLI Verifier to calculate NLI scores
  - Call Truth Scorer to calculate final truth score
  - Call Verdict Classifier to determine verdict
  - Extract supporting_sources URLs from evidence
  - Generate summary text based on verdict and truth score
  - Return VerifyResponse with HTTP 200 OK
  - Implement error handling for all edge cases (empty claim, no sources, model unavailable)
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 9.1, 9.2, 9.4, 10.1, 10.2, 10.5, 11.1_

- [~] 10. Implement POST /api/analyze legacy endpoint
  - Create analyze_legacy() async route handler in main.py
  - Map "text" field from request to "claim" field in VerifyRequest
  - Forward request to verify_claim() endpoint
  - Return same VerifyResponse structure
  - _Requirements: 13.1, 13.2, 13.3_

- [~] 11. Configure CORS middleware
  - Add CORSMiddleware to FastAPI application
  - Allow all origins (allow_origins=["*"])
  - Allow all HTTP methods (allow_methods=["*"])
  - Allow all headers (allow_headers=["*"])
  - Allow credentials (allow_credentials=True)
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [~] 12. Checkpoint - Verify basic application structure
  - Ensure application starts without errors
  - Verify Swagger UI documentation is accessible at /docs
  - Verify ReDoc documentation is accessible at /redoc
  - Test that /verify endpoint accepts POST requests with valid JSON
  - Ask the user if questions arise.

- [ ] 13. Implement comprehensive unit tests
  - [~] 13.1 Write unit tests for Configuration Loader
    - Test loading predefined domain weights
    - Test loading weights from JSON file
    - Test weight validation and default values
    - Test handling of missing/invalid JSON file
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 15.1, 15.2, 15.3_

  - [~] 13.2 Write unit tests for Verdict Classifier
    - Test threshold logic for all three verdict categories
    - Test boundary conditions (39.9, 40.0, 40.1, 65.0, 65.1)
    - Test edge cases (0, 1, 50, 99, 100)
    - _Requirements: 8.1, 8.2_

  - [~] 13.3 Write unit tests for Truth Scorer
    - Test weighted average calculation with multiple sources
    - Test normalization to 1-100 range
    - Test default score of 50 with no sources
    - Test clamping behavior (values < 1 and > 100)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [~] 13.4 Write unit tests for NLI Verifier
    - Test NLI score mapping (label 0→0.0, 1→1.0, 2→0.5)
    - Test evidence truncation to 1000 characters
    - Test default score of 0.5 when model is None
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [~] 13.5 Write unit tests for Evidence Retriever
    - Test claim truncation to 350 characters
    - Test domain extraction from URLs
    - Test source weight assignment
    - Test result limiting to 5 sources
    - Test handling of empty results
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 14. Implement integration tests
  - [~] 14.1 Write integration test for end-to-end verification flow
    - Mock Tavily API responses
    - Mock NLI model inference
    - Test complete pipeline from request to response
    - Verify response structure and field types
    - _Requirements: 1.1, 9.1, 9.2, 9.4_

  - [~] 14.2 Write integration test for error handling
    - Test behavior when Tavily API is unavailable
    - Test behavior when NLI model fails to load
    - Test behavior with empty claim
    - Verify HTTP 200 response with default values
    - _Requirements: 10.1, 10.2, 10.5_

  - [~] 14.3 Write integration test for legacy /api/analyze endpoint
    - Test request mapping from "text" to "claim"
    - Verify response structure matches /verify endpoint
    - _Requirements: 13.1, 13.2, 13.3_

  - [~] 14.4 Write integration test for CORS headers
    - Test cross-origin request handling
    - Verify CORS headers in response
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 15. Implement error handling and edge case tests
  - [~] 15.1 Test malformed JSON payload handling
    - Send invalid JSON to /verify endpoint
    - Verify 400 Bad Request response with validation details
    - _Requirements: 1.5_

  - [~] 15.2 Test claim truncation edge cases
    - Test claim exactly 5000 characters
    - Test claim exceeding 5000 characters
    - Verify truncation occurs correctly
    - _Requirements: 1.3_

  - [~] 15.3 Test empty and whitespace-only claims
    - Test empty string claim
    - Test whitespace-only claim
    - Verify default response (50, Uncertain)
    - _Requirements: 1.2, 10.5_

  - [~] 15.4 Test concurrent request handling
    - Send multiple verification requests simultaneously
    - Verify all requests complete successfully
    - Verify no race conditions or shared state issues
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [~] 15.5 Test timeout handling
    - Simulate Tavily API timeout (>12 seconds)
    - Verify timeout exception is caught
    - Verify empty list is returned
    - Verify default response is generated
    - _Requirements: 10.3, 11.2, 11.3_

- [ ] 16. Implement logging and monitoring
  - [~] 16.1 Add structured logging for model initialization
    - Log successful NLI model load
    - Log model load failures with exception details
    - Log Tavily client initialization
    - Log Tavily client initialization failures
    - _Requirements: 14.1, 14.2_

  - [~] 16.2 Add structured logging for verification process
    - Log per-source scoring details (domain, NLI score, weight, weighted score)
    - Log evidence retrieval results
    - Log API failures with exception details
    - _Requirements: 14.3, 14.4, 14.5_

  - [~] 16.3 Add structured logging for configuration loading
    - Log domain weights loading
    - Log JSON file load failures
    - Log invalid weight values with warnings
    - _Requirements: 14.5_

- [ ] 17. Implement API documentation
  - [~] 17.1 Add docstrings to all functions and endpoints
    - Document parameters, return types, and exceptions
    - Add examples in docstrings
    - _Requirements: 17.1, 17.2, 17.3_

  - [~] 17.2 Verify Swagger UI documentation
    - Verify /docs endpoint displays all endpoints
    - Verify request/response schemas are documented
    - Verify example requests and responses are shown
    - _Requirements: 17.1, 17.3, 17.4_

  - [~] 17.3 Verify ReDoc documentation
    - Verify /redoc endpoint displays all endpoints
    - Verify schemas are properly documented
    - _Requirements: 17.2, 17.3_

- [~] 18. Final checkpoint - Ensure all tests pass and SLA compliance
  - Run all unit tests and verify they pass
  - Run all integration tests and verify they pass
  - Verify response time SLA (30 seconds) with realistic test data
  - Verify Tavily API timeout (12 seconds) is enforced
  - Verify NLI inference completes within 5 seconds for 5 sources
  - Ask the user if questions arise.

## Notes

- All tasks reference specific requirements for traceability
- Tasks are ordered sequentially to build incrementally
- Core implementation tasks (1-11) must be completed before testing
- Testing tasks (13-17) validate implementation against requirements
- Checkpoints (12, 18) ensure incremental validation
- All code should follow Python best practices and PEP 8 style guidelines
- Use type hints throughout for better code clarity
- Implement proper error handling with try-except blocks
- Use async/await for all I/O operations (API calls, file reads)

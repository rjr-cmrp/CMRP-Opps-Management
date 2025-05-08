-- Migration: Create opportunity_revisions table (corrected for opps_monitoring)
CREATE TABLE IF NOT EXISTS opportunity_revisions (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER REFERENCES opps_monitoring(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_fields JSONB,
    full_snapshot JSONB
);

-- Table to track every change to the forecast date/week for each opportunity
CREATE TABLE IF NOT EXISTS forecast_revisions (
    id SERIAL PRIMARY KEY,
    opportunity_uid TEXT NOT NULL,
    old_forecast_date TEXT,
    new_forecast_date TEXT NOT NULL,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comment TEXT
);

-- Index for faster lookup by opportunity
CREATE INDEX IF NOT EXISTS idx_forecast_revisions_uid ON forecast_revisions(opportunity_uid);

-- Mock revision history for Kingsford Hotel Bacolod CCTV
INSERT INTO opportunity_revisions (opportunity_uid, revision_number, changed_by, changed_at, changed_fields, full_snapshot) VALUES
('dd4e434a-3b62-445d-8186-3d85bed2bce0', 1, 'alice', '2025-01-10T09:00:00Z', '{"rev#": "1", "Final amt": "1000000", "Margin": "12%", "Client Deadline": "2025-01-31", "Submitted Date": "2025-01-15"}', '{"rev#": "1", "Final amt": "1000000", "Margin": "12%", "Client Deadline": "2025-01-31", "Submitted Date": "2025-01-15"}'),
('dd4e434a-3b62-445d-8186-3d85bed2bce0', 2, 'bob', '2025-01-20T10:30:00Z', '{"rev#": "2", "Final amt": "1100000", "Margin": "13%", "Client Deadline": "2025-02-10", "Submitted Date": "2025-01-25"}', '{"rev#": "2", "Final amt": "1100000", "Margin": "13%", "Client Deadline": "2025-02-10", "Submitted Date": "2025-01-25"}'),
('dd4e434a-3b62-445d-8186-3d85bed2bce0', 3, 'carol', '2025-02-01T14:00:00Z', '{"rev#": "3", "Final amt": "1150000", "Margin": "13%", "Client Deadline": "2025-02-20", "Submitted Date": "2025-02-05"}', '{"rev#": "3", "Final amt": "1150000", "Margin": "13%", "Client Deadline": "2025-02-20", "Submitted Date": "2025-02-05"}'),
('dd4e434a-3b62-445d-8186-3d85bed2bce0', 4, 'dave', '2025-02-15T11:00:00Z', '{"rev#": "4", "Final amt": "1200000", "Margin": "14%", "Client Deadline": "2025-03-01", "Submitted Date": "2025-02-18"}', '{"rev#": "4", "Final amt": "1200000", "Margin": "14%", "Client Deadline": "2025-03-01", "Submitted Date": "2025-02-18"}'),
('dd4e434a-3b62-445d-8186-3d85bed2bce0', 5, 'eve', '2025-03-01T16:00:00Z', '{"rev#": "5", "Final amt": "1250000", "Margin": "14%", "Client Deadline": "2025-03-15", "Submitted Date": "2025-03-05"}', '{"rev#": "5", "Final amt": "1250000", "Margin": "14%", "Client Deadline": "2025-03-15", "Submitted Date": "2025-03-05"}'),
('dd4e434a-3b62-445d-8186-3d85bed2bce0', 6, 'frank', '2025-03-20T09:30:00Z', '{"rev#": "6", "Final amt": "1300000", "Margin": "15%", "Client Deadline": "2025-03-31", "Submitted Date": "2025-03-25"}', '{"rev#": "6", "Final amt": "1300000", "Margin": "15%", "Client Deadline": "2025-03-31", "Submitted Date": "2025-03-25"}');

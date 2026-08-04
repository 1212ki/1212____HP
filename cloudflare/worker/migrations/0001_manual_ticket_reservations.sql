ALTER TABLE ticket_reservations ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
ALTER TABLE ticket_reservations ADD COLUMN contact TEXT;
ALTER TABLE ticket_reservations ADD COLUMN internal_note TEXT;

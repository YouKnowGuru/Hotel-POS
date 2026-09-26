-- Insert required users for POS system
-- Passwords are bcrypt-hashed (cost factor 10)

INSERT INTO users (username, password, role, name)
VALUES ('admin', '$2b$10$MoSnaZQkGu8FHDeZAx6cqe9D002yc2iFQOeBpxeSa3JBmHmjFhUJ2', 'admin', 'Administrator')
ON DUPLICATE KEY UPDATE password = '$2b$10$MoSnaZQkGu8FHDeZAx6cqe9D002yc2iFQOeBpxeSa3JBmHmjFhUJ2', role = 'admin', name = 'Administrator';

INSERT INTO users (username, password, role, name)
VALUES ('waiter', '$2b$10$fSQJld7U6D/yWCBXVka7GuFu/pa/B7fcB1WkNcafDWmhC/Hicqc02', 'waiter', 'Waiter User')
ON DUPLICATE KEY UPDATE password = '$2b$10$fSQJld7U6D/yWCBXVka7GuFu/pa/B7fcB1WkNcafDWmhC/Hicqc02', role = 'waiter', name = 'Waiter User';


INSERT INTO users (username, password, role, name)
VALUES ('manager', '$2b$10$ZHgoUPKiOeCqQumtZHSTyOih1yZa3pnnElyV7k8AUdBxWeYyyNLtG', 'manager', 'Manager User')
ON DUPLICATE KEY UPDATE password = '$2b$10$ZHgoUPKiOeCqQumtZHSTyOih1yZa3pnnElyV7k8AUdBxWeYyyNLtG', role = 'manager', name = 'Manager User';

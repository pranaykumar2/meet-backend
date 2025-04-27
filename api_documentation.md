# Vignan Meet API Documentation

## Authentication

### Register a user
- **URL**: `/api/register`
- **Method**: `POST`
- **Auth required**: No
- **Data example**:
  ```json
  {
    "username": "user123",
    "password": "password123",
    "email": "user@example.com"
  }
  ```

### Login
- **URL**: `/api/login`
- **Method**: `POST`
- **Auth required**: No
- **Data example**:
  ```json
  {
    "username": "user123",
    "password": "password123"
  }
  ```

## Group Management

### Create a group
- **URL**: `/api/groups`
- **Method**: `POST`
- **Auth required**: Yes
- **Data example**:
  ```json
  {
    "name": "Project Team Alpha",
    "description": "Team for Project Alpha development"
  }
  ```

### Get user's groups
- **URL**: `/api/groups`
- **Method**: `GET`
- **Auth required**: Yes

### Get specific group
- **URL**: `/api/groups/:id`
- **Method**: `GET`
- **Auth required**: Yes

### Update group
- **URL**: `/api/groups/:id`
- **Method**: `PUT`
- **Auth required**: Yes (must be group admin)
- **Data example**:
  ```json
  {
    "name": "Updated Team Name",
    "description": "Updated description"
  }
  ```

### Delete group
- **URL**: `/api/groups/:id`
- **Method**: `DELETE`
- **Auth required**: Yes (must be group creator)

### Add member to group
- **URL**: `/api/groups/:id/members`
- **Method**: `POST`
- **Auth required**: Yes (must be group admin)
- **Data example**:
  ```json
  {
    "user_id": 5,
    "role": "member"
  }
  ```

### Get group members
- **URL**: `/api/groups/:id/members`
- **Method**: `GET`
- **Auth required**: Yes (must be group member)

### Update member role
- **URL**: `/api/groups/:id/members/:userId`
- **Method**: `PUT`
- **Auth required**: Yes (must be group admin)
- **Data example**:
  ```json
  {
    "role": "admin"
  }
  ```

### Remove member from group
- **URL**: `/api/groups/:id/members/:userId`
- **Method**: `DELETE`
- **Auth required**: Yes (must be group admin or self)

## Meeting Management

### Create a meeting
- **URL**: `/api/meetings`
- **Method**: `POST`
- **Auth required**: Yes
- **Data example**:
  ```json
  {
    "title": "Weekly Standup",
    "description": "Weekly team progress meeting",
    "meeting_time": "2025-05-01 15:00:00",
    "duration_minutes": 45,
    "group_id": 2
  }
  ```

### Get user's meetings
- **URL**: `/api/meetings`
- **Method**: `GET`
- **Auth required**: Yes

### Get meetings for a group
- **URL**: `/api/meetings/group/:groupId`
- **Method**: `GET`
- **Auth required**: Yes (must be group member)

### Get meeting details
- **URL**: `/api/meetings/:id`
- **Method**: `GET`
- **Auth required**: Yes

### Update meeting
- **URL**: `/api/meetings/:id`
- **Method**: `PUT`
- **Auth required**: Yes (must be meeting creator)
- **Data example**:
  ```json
  {
    "title": "Updated Meeting Title",
    "description": "Updated description",
    "meeting_time": "2025-05-02 16:00:00",
    "duration_minutes": 60
  }
  ```

### Delete meeting
- **URL**: `/api/meetings/:id`
- **Method**: `DELETE`
- **Auth required**: Yes (must be meeting creator)

### User Search API

### Search for users to add to groups
- **URL**: `/api/users/search?query=searchterm`
- **Method**: `GET`
- **Auth required**: Yes
- **Query parameters**:
    - `query`: Search term (minimum 3 characters)

# Database Setup SQL Script

Here's the SQL script to create the necessary database tables for the group management and meeting functionality:

```sql
-- First, let's check if the tables already exist and drop them if needed
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS `groups`;

-- Make sure we have the users table
-- If you don't have a users table yet, uncomment and execute this:
-- CREATE TABLE IF NOT EXISTS users (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   username VARCHAR(255) NOT NULL UNIQUE,
--   email VARCHAR(255) NOT NULL UNIQUE,
--   password VARCHAR(255) NOT NULL,
--   is_admin BOOLEAN DEFAULT FALSE,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Create groups table
CREATE TABLE `groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Create group members table (many-to-many relationship between users and groups)
CREATE TABLE `group_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `group_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `role` ENUM('member', 'admin') DEFAULT 'member',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_membership` (`group_id`, `user_id`)
);

-- Create meetings table
CREATE TABLE `meetings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `meeting_time` DATETIME NOT NULL,
  `duration_minutes` INT DEFAULT 60,
  `created_by` INT NOT NULL,
  `group_id` INT,
  `room_code` VARCHAR(20) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE SET NULL
);

-- Add index to improve query performance
CREATE INDEX idx_group_meetings ON meetings(group_id);
CREATE INDEX idx_user_meetings ON meetings(created_by);
```


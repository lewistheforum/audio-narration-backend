# AI AGENT EXECUTION: API IMPLEMENTATION (COD COMPLETION LOGIC)

## 1. Role & Task
You are a **Senior Backend Engineer**. Your task is to implement the API endpoint `/staff/:id/complete-cod-appointment` with sequential business logic across multiple database tables.

## 2. Context & Logic Requirements
When this API is called, you must implement a **Database Transaction** (ensuring that if one step fails, the entire process rolls back) to perform the following steps:

### Step 1: Update Appointment
* Find the `Appointment` based on `:id` (appointmentId).

* Change the `status` of the Appointment to `COMPLETED`.

### Step 2: Update Transactions
* Find all records in the `Transaction` table associated with this `appointmentId`.

* Change the status of Transactions from `PENDING` to `SUCCESS`.

### Step 3: Update Appointment Packages
* Query the `AppointmentPackage` table belonging to this Appointment.

* Find packages with the status `pending_payment` and change all of them to `paid`.

## 3. Technical Constraints
* **Framework:** Use the project's current technology (Node.js/NestJS with TypeORM or Prisma).

* **Database:** PostgreSQL.

* **Security:** Ensure only `staff` have permission to call this API.

* **Error Handling:** * Return a 404 error if the Appointment is not found.

* Returns a 400 error if the Appointment was previously in the COMPLETED state.

* Returns a 500 error if any errors occurred during the Transaction execution.

## 4. Output Requirements
Please provide:
1. Detailed source code for the Controller and Service.

2. Corresponding SQL statements or ORM code.

3. The structure of the returned Response (Success & Error).

---
**COMMAND:** Please begin implementing and writing detailed code for this API now.
# Host Guide: Setting Up Your Event Form

One page. Follow it once per event.

## 1. Start from the template
1. Open the template form: (https://docs.google.com/forms/d/14x0nOUOawWOkj6jLCFZZWLUE51YNh6w4b4p9M6JdSSI/edit)
2. Click "Make a copy". This gives you your own form with the right questions already in it.
3. Rename the form to your event name.

## 2. What must stay exactly as it is
These four questions must exist, once each, with these exact titles:

| Question title | Type | Required | Setting |
|---|---|---|---|
| Full Name | Short answer | Yes | none |
| Email Address | Short answer | Yes | Response validation > Text > Email |
| Organization | Short answer | Yes | none |
| Contact Number | Short answer | Yes | Response validation > Regular expression > Matches > `^[0-9+ ()-]{7,15}$` |

Do not rename, retype, or delete them. Capital letters and extra spaces do not matter, but spelling and punctuation do ("Email" or "Full name:" will not work).

## 3. What you can change
- Add your own questions after the four above (for example Dietary Needs or Year Level). Any title is fine, except the four above. They appear in the dashboard under "More details".
- Change the form title, description, colors, and confirmation message.

## 4. What not to do
- Do not turn on "Collect email addresses" in Settings > Responses. It adds a second Email Address column and the dashboard will block it.
- Do not use two questions with the same title.
- Do not type into, insert, move, or delete columns in the responses sheet. Change questions in the form instead.
- Do not rename the "Accepted" tab or change its first row.

## 5. Connect the sheet
1. In your form, open the Responses tab.
2. Click the green Sheets icon > Create a new spreadsheet.
3. Open the spreadsheet and check row 1: Timestamp, Full Name, Email Address, Organization, Contact Number, then your extra questions.
4. Click Share and add this email as Editor: [PASTE SERVICE ACCOUNT EMAIL HERE]
5. Send the spreadsheet link (or ID) to the person who runs the dashboard.

## 6. Test before you share the form
1. Click Preview in the form and submit one test entry.
2. Open the dashboard and look at the Form Check panel. It should say "Form check: ready" and show OK next to all four titles.
3. Your test person should appear in the Registered tab.

## 7. If the Form Check says "action needed"
| Message | What to do |
|---|---|
| Email Address: not found | Add a Short answer question titled exactly "Email Address" (Required, Email validation). If it shows "Did you mean ...", rename that question to the exact title. |
| Full Name / Organization / Contact Number: not found | Add or rename the question to the exact title shown. |
| found 2 times | Keep one question with that title and rename or delete the other. For Email Address, also turn off "Collect email addresses". |
| Column ... has answers but no question title | Give that question a title in the form. |
| Column A is not "Timestamp" | The app is reading the wrong tab. Tell the dashboard owner to set FORM_TAB to the form responses tab. |
| Tab "Accepted" headers were changed | Restore row 1 of the Accepted tab. Ask the dashboard owner for the exact list. |

After fixing the form, press Re-check in the dashboard.

Easiest fix for anything confusing: make a fresh copy of the template and start again.

## 8. Rows the dashboard skips
The Registered tab lists skipped rows with a reason, for example "Row 14: email invalid". Reasons: name missing, email missing, email invalid, duplicate email (the earliest submission is kept). Fix the person's details by asking them to submit the form again.

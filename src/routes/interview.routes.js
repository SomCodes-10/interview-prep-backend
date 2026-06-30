const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const interviewController = require("../controllers/interview.controller")
const upload = require("../middlewares/file.middleware")

const intertviewRouter = express.Router()
/**
 * @router POST /api/interview
 * @description Generate new interview report on the basis of user self description , resume PDF and Job description
 * @access private
 */
intertviewRouter.post("/",authMiddleware.authUser,upload.single("resume"),interviewController.generateInterviewReportController)

/**
 * @router POST /api/interview/report/:interviewId
 * @description get interview report by interviewId
 * @access private
 */
intertviewRouter.get("/report/:interviewId",authMiddleware.authUser,upload.single("resume"),interviewController.getInterviewReportByIdController)

/** 
 * @route GET/api/interview/
 * @description get all interview report of logged in user.
 * @access private
*/
intertviewRouter.get("/",authMiddleware.authUser,upload.single("resume"),interviewController.getAllInterviewReportsController)

/**
 * @route POST /api/interview/resume
 * @description Generate an ATS-friendly resume PDF tailored to the provided job description using the uploaded resume and self description.
 * @access Private
 */
intertviewRouter.post("/resume/pdf/:interviewReportId",authMiddleware.authUser,upload.single("resume"),interviewController.generateResumePdfController)

module.exports = intertviewRouter
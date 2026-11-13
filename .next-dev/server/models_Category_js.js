"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "models_Category_js";
exports.ids = ["models_Category_js"];
exports.modules = {

/***/ "./models/Category.js":
/*!****************************!*\
  !*** ./models/Category.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var mongoose__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mongoose */ \"mongoose\");\n/* harmony import */ var mongoose__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mongoose__WEBPACK_IMPORTED_MODULE_0__);\n\nconst CategorySchema = new (mongoose__WEBPACK_IMPORTED_MODULE_0___default().Schema)({\n    name: {\n        type: String,\n        required: true\n    },\n    parentId: {\n        type: (mongoose__WEBPACK_IMPORTED_MODULE_0___default().Schema).Types.ObjectId,\n        default: null,\n        index: true\n    },\n    createdAt: {\n        type: Date,\n        default: Date.now\n    }\n});\nCategorySchema.index({\n    parentId: 1,\n    name: 1\n}, {\n    unique: true,\n    sparse: true\n});\nconst Category = (mongoose__WEBPACK_IMPORTED_MODULE_0___default()) && (mongoose__WEBPACK_IMPORTED_MODULE_0___default().models) && (mongoose__WEBPACK_IMPORTED_MODULE_0___default().models).Category ? (mongoose__WEBPACK_IMPORTED_MODULE_0___default().models).Category : mongoose__WEBPACK_IMPORTED_MODULE_0___default().model(\"Category\", CategorySchema);\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Category);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9tb2RlbHMvQ2F0ZWdvcnkuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQWdDO0FBRWhDLE1BQU1DLGlCQUFpQixJQUFJRCx3REFBZSxDQUFDO0lBQ3pDRyxNQUFNO1FBQUVDLE1BQU1DO1FBQVFDLFVBQVU7SUFBSztJQUNyQ0MsVUFBVTtRQUFFSCxNQUFNSix3REFBZSxDQUFDUSxLQUFLLENBQUNDLFFBQVE7UUFBRUMsU0FBUztRQUFNQyxPQUFPO0lBQUs7SUFDN0VDLFdBQVc7UUFBRVIsTUFBTVM7UUFBTUgsU0FBU0csS0FBS0MsR0FBRztJQUFDO0FBQzdDO0FBRUFiLGVBQWVVLEtBQUssQ0FBQztJQUFFSixVQUFVO0lBQUdKLE1BQU07QUFBRSxHQUFHO0lBQUVZLFFBQVE7SUFBTUMsUUFBUTtBQUFLO0FBRTVFLE1BQU1DLFdBQVcscURBQWFqQix3REFBZSxJQUFJQSx3REFBZSxDQUFDaUIsUUFBUSxHQUFJakIsd0RBQWUsQ0FBQ2lCLFFBQVEsR0FBR2pCLHFEQUFjLENBQUMsWUFBWUM7QUFDbkksaUVBQWVnQixRQUFRQSxFQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vc2hyZWUtZHVyZ2Etc3RhdGlvbmFyeS8uL21vZGVscy9DYXRlZ29yeS5qcz80YzgxIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtb25nb29zZSBmcm9tICdtb25nb29zZSc7XHJcblxyXG5jb25zdCBDYXRlZ29yeVNjaGVtYSA9IG5ldyBtb25nb29zZS5TY2hlbWEoe1xyXG4gIG5hbWU6IHsgdHlwZTogU3RyaW5nLCByZXF1aXJlZDogdHJ1ZSB9LFxyXG4gIHBhcmVudElkOiB7IHR5cGU6IG1vbmdvb3NlLlNjaGVtYS5UeXBlcy5PYmplY3RJZCwgZGVmYXVsdDogbnVsbCwgaW5kZXg6IHRydWUgfSxcclxuICBjcmVhdGVkQXQ6IHsgdHlwZTogRGF0ZSwgZGVmYXVsdDogRGF0ZS5ub3cgfVxyXG59KTtcclxuXHJcbkNhdGVnb3J5U2NoZW1hLmluZGV4KHsgcGFyZW50SWQ6IDEsIG5hbWU6IDEgfSwgeyB1bmlxdWU6IHRydWUsIHNwYXJzZTogdHJ1ZSB9KTtcclxuXHJcbmNvbnN0IENhdGVnb3J5ID0gKG1vbmdvb3NlICYmIG1vbmdvb3NlLm1vZGVscyAmJiBtb25nb29zZS5tb2RlbHMuQ2F0ZWdvcnkpID8gbW9uZ29vc2UubW9kZWxzLkNhdGVnb3J5IDogbW9uZ29vc2UubW9kZWwoJ0NhdGVnb3J5JywgQ2F0ZWdvcnlTY2hlbWEpO1xyXG5leHBvcnQgZGVmYXVsdCBDYXRlZ29yeTtcclxuIl0sIm5hbWVzIjpbIm1vbmdvb3NlIiwiQ2F0ZWdvcnlTY2hlbWEiLCJTY2hlbWEiLCJuYW1lIiwidHlwZSIsIlN0cmluZyIsInJlcXVpcmVkIiwicGFyZW50SWQiLCJUeXBlcyIsIk9iamVjdElkIiwiZGVmYXVsdCIsImluZGV4IiwiY3JlYXRlZEF0IiwiRGF0ZSIsIm5vdyIsInVuaXF1ZSIsInNwYXJzZSIsIkNhdGVnb3J5IiwibW9kZWxzIiwibW9kZWwiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./models/Category.js\n");

/***/ })

};
;
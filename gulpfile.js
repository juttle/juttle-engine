var eslint = require('gulp-eslint');
var gulp = require('gulp');

gulp.task('lint', function() {
    return gulp.src([
        'bin/*',
        'lib/**/*.js',
        'gulpfile.js'
    ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('default', ['lint']);

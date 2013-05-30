// Use Ajax so that page refreshes aren't necessary when using the UI

$(document).click(function(event) {
    // Prevent default click behaviour for all links unless they have the class
    // 'outbound'. In that case we assume it's a link to a page outside of
    // SoundStation and should proceed normally
    if (!$(event.target).hasClass('outbound')) {
      event.preventDefault();
      var href = $(event.target).attr('href');
      // Perform ajax request
      $.ajax({
        url: href,
        cache: false
      });
      return false;
    }
});

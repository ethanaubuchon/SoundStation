// Use Ajax so that page refreshes aren't necessary when using the UI

var lastClick = 0;

$(document).click(function(event) {
    // Prevent default click behaviour for all links unless they have the class
    // 'outbound'. In that case we assume it's a link to a page outside of
    // SoundStation and should proceed normally
    target = $(event.target);

    // If we clicked on an icon within an anchor, set the anchor as target
    if (target.parent().hasClass('prevent-default'))
      target = target.parent();

    var href = target.attr('href');

    if (target.is('a') && target.hasClass('prevent-default')) {
      event.preventDefault();

      // Also prevent the user from clicking too quickly
      var now = new Date().getTime();
      if (now - lastClick > 400) {
        // Perform ajax request
        $.ajax({
          url: href,
          cache: false
        });
        lastClick = now;
      }

      return false;
    }

    // Force re-rendering the page entirely if clicking on links to pages that 
    // render different templates. Otherwise Derby will render with the old template
    if (target.is('a'))
      window.location.href = href;
});

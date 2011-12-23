/**
 * .reel Unit Tests
 */
(function($){

  module('Animation', reel_test_module_routine);

  asyncTest( 'When at least one instance of Reel is present in the DOM a shared ticker is started', function()
  {
    expect(1);

    $(document).bind('tick.reel.test', tick);

    var
      ticks = 0;

    setTimeout(function(){
      ok( ticks == 0, 'Ticker isn\'t running when no Reel is on');
      start();
    }, 1000);

    function tick(){
      ticks++
    }
  });

  asyncTest( 'Ticker is driven by `leader`\'s data from `$.reel.leader()`', function()
  {
    expect(9);

    $(document).bind('tick.reel.test', tick);

    var
      ticks = 0,
      $faster = $('#image').reel({ tempo: 20 }),
      $slower = $('#image2').reel({ tempo: 10 });

    setTimeout(function(){
      deepEqual( $.reel.leader(), $faster.data(), 'Leader\'s data are the first (oldest living) instance\'s data')
      equals( $.reel.leader('tempo'), $faster.data('tempo'), 'Timer keeps faster tempo dictated by the leader');

      ok( $faster.unreel(), 'The older faster instance destroyed (the latter slower instance remains)');

      setTimeout(function(){
        deepEqual( $.reel.leader(), $slower.data(), 'Leader\'s data are the second (now the only) instance\'s data')
        equals( $.reel.leader('tempo'), $slower.data('tempo'), 'Ticker slowed down');

        ok( $slower.unreel(), 'Slower instance removed too (no instance remains)')
        var
          ticks_copy= ticks;

        setTimeout(function(){
          equals( $.reel.leader(), undefined, 'Without a leader there\'s no data');
          equals( $.reel.leader('tempo'), undefined, 'and no leader\'s tempo');
          equals( ticks_copy, ticks, 'Ticker is stopped.');

          start();
        }, 1000);

      }, 1000);

    }, 1000);

    function tick(){
      ticks++
    }
  });

  // We generate tests for several different tempos ranging from 6 to 48
  $.each([6, 8, 10, 12, 18, 24, 36], function(ix, tempo){

    var
      one_second= 1000,
      lazy_tempo= tempo / ($.reel.lazy? $.reel.def.laziness : 1),
      tolerate= 10, // percents
      tolerance= {
        lo: 1 - tolerate / 100,
        hi: 1 + tolerate / 100
      }

    // We also try both animated and non-animated
    $.each([0, 1], function(ixx, speed){

      asyncTest( 'Measuring 1 second timing accuracy when running ' + (speed ? 'animated' : 'non-animated') + ' instance at `tempo: ' + lazy_tempo + '`', function()
      {
        expect(2);

        var
          ticks= 0,
          sum= 0,
          bang= +new Date(),
          $reel= $('#image').reel({ tempo: tempo, speed: speed })

        $(document).bind('tick.reel.test', function tick(){
          ticks++;
        });

        setTimeout(function(duration){
          var filled;
          duration= +new Date() - bang;
          ok( (filled= duration / one_second) >= tolerance.lo && filled <= tolerance.hi, duration + ' ms is within the ' + tolerate + ' % tolerance.');
          ok( true, 'Received ' + ticks + ' ticks');
          start();
        }, one_second);
      });
    });
  });

  asyncTest( 'Running instances have their overall running cost (in ms) exposed as `$.reel.cost`', function()
  {
    expect(4);

    $('#image').reel({ speed: 1 });

    setTimeout(function(){
      var
        cost_of_one

      ok( is('Number', cost_of_one= $.reel.cost), 'Number `$.reel.cost`')
      ok( cost_of_one >= 0, 'Non-zero cost of one instance (' + cost_of_one + ' ms)' )

      $('#image2').reel({ speed: 2 });
      $('#stitched_looping').reel({ speed: 2 });

      setTimeout(function(){
        var
          cost_of_three= $.reel.cost

        ok( cost_of_three > 0, 'Non-zero cost of two instances (' + cost_of_three + ' ms)' )
        ok( cost_of_three > cost_of_one, 'Running cost of three instances is higher then of one' )
        start();

      }, 100);

    }, 100);

  });

  asyncTest( 'Removal of redundant `rowChange` and untimately the `frameChange` event from `loaded.fu` handler left the functionality untouched)', function()
  {
    var
      index= 0,
      setups= [
        { /* No `opening` equals `opening: 0` */ },
        { opening: 0 },
        { opening: 1.23 }
      ]
    expect(setups.length);

    try_one();

    function try_one(){
      var
        $reel= $('#image').reel(setups[index]),
        ticked= false

      $reel.bind('frameChange.test', function(){
        ok( !ticked, '`openingDone` induced `frameChange` triggered before the first tick');

        $reel.unbind('.test').unreel();
        $(document).unbind('.test');
        index++;

        if (index < setups.length) try_one()
        else start();
      });
      $(document).bind('tick.reel.test', function(){
        ticked= true;
      });
    }
  });

  asyncTest( 'Triggering `stop` event stops the instance instantly on the spot', function()
  {
    var
      frames= 36,
      frame= 1

    expect(4 * frames);

    try_frame_one_by_one();

    function try_frame_one_by_one(){
      var
        $reel= $('#image').reel({
          speed: 1,
          delay: 0.05,
          frame: frame - 5
        })

      $reel.bind('frameChange.test', function(e){
        var
          reel_frame= $reel.data('frame')

        if (reel_frame == frame){
          $reel.unbind('frameChange.test');
          $reel.parent().bind('stop.test', function(){
            ok( $reel.data('stopped'), 'Instance reports to be stopped');
            ok( !$reel.data('playing'), 'Instance reports to not be playing')
            equal( $reel.data('frame'), frame, 'Actual frame is spot on the target');

            // After a while we double-check if it REALLY ain't moving
            setTimeout(function(){
              equal( $reel.data('frame'), frame, 'Verified not moving even after the delay')

              // And reload new round
              $reel.unbind('.test');
              frame++;
              if (frame <= frames) setTimeout(try_frame_one_by_one, 0)
              else start();
            }, 100);
          });

          // Firing the `stop` asynchronously in the next thread cycle
          setTimeout(function(){
            $reel.trigger('stop');
          }, 5);
        }
      });
    }
  });

  asyncTest( 'Triggering `pause` event pauses the instance instantly on the spot and resumes playback after the `delay`', function()
  {
    var
      frames= 36,
      frame= 1

    expect(4 * frames);

    try_frame_one_by_one();

    function try_frame_one_by_one(){
      var
        $reel= $('#image').reel({
          speed: 1,
          delay: 0.05,
          frame: frame - 5
        })

      $reel.bind('frameChange.test', function(e){
        var
          reel_frame= $reel.data('frame')

        if (reel_frame == frame){
          $reel.unbind('frameChange.test');
          $reel.parent().bind('pause.test', function(){
            console.log($reel.data('playing'))
            ok( !$reel.data('stopped'), 'Instance reports to not be stopped');
            ok( !$reel.data('playing'), 'Instance reports to not be playing')
            equal( $reel.data('frame'), frame, 'Actual frame is spot on the target');

            // After a while we double-check if it REALLY ain't moving
            setTimeout(function(){
              ok( $reel.data('frame') != frame, 'Verified it resumed movement after the delay')

              // And reload new round
              $reel.unbind('.test');
              frame++;
              if (frame <= frames) setTimeout(try_frame_one_by_one, 0)
              else start();
            }, 100);
          });

          // Firing the `pause` asynchronously in the next thread cycle
          setTimeout(function(){
            $reel.trigger('pause');
          }, 5);
        }
      });
    }
  });

})(jQuery);

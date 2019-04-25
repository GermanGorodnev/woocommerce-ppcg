/* global wc_ppec_context */

function redirMe($) {
    var a = $.ajax({
        type: 'POST',
        // checkout_url: "/?wc-ajax=checkout"
        url: wc_checkout_params.checkout_url,
        data: $('form.checkout').serialize(),
        dataType: 'json',
    });
    // console.log('sent ajax checkout');
    ga('require', 'ecommerce');
    var sa = function (cb) {
        // send analytics
        // ga('require', 'ecommerce');
        var id = DataForAnalytic.order_id;
        ga('ecommerce:addTransaction', {
            'id': id,                     // Transaction ID. Required.
            'revenue': DataForAnalytic.order_price,               // Grand Total.
        });
        // ga('ecommerce:send');
        var product, iter;
        for (iter = 0; iter < DataForAnalytic.products.length; iter += 1) {
            product = DataForAnalytic.products[iter];
            ga('ecommerce:addItem', {
                'id': id,                     // Transaction ID. Required.
                'name': product.name,    // Product name. Required.
                'price': product.price,                 // Unit price.
                'quantity': product.count                 // Quantity.
            });
        }
        ga('ecommerce:send');
        setTimeout(cb, 1200);
    }
    var checker = function () {
        var mycb = function (res) {
            // console.log(res);
            if (res === true) {
                // console.log(DataForAnalytic);
                // if (DataForAnalytic.order_id) {
                // 	DataForAnalytic.order_id += 10000;
                // } else {
                // 	DataForAnalytic.order_id = 8009;
                // }
                a.abort();
                sa(function () {
                    window.location.replace(location.protocol + '//' + location.hostname + "/thank-you/");
                });
            } else {
                setTimeout(poll.bind(this, mycb), 1000 * .8);
            }
        };
        poll(mycb);
    };
    checker();
}

; (function ($, window, document) {
	'use strict';

	// Show error notice at top of checkout form, or else within button container
	var showError = function (errorMessage, selector) {
		var $container = $('.woocommerce-notices-wrapper, form.checkout');

		if (!$container || !$container.length) {
			$(selector).prepend(errorMessage);
			return;
		} else {
			$container = $container.first();
		}

		// Adapted from https://github.com/woocommerce/woocommerce/blob/ea9aa8cd59c9fa735460abf0ebcb97fa18f80d03/assets/js/frontend/checkout.js#L514-L529
		$('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message').remove();
		$container.prepend('<div class="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout">' + errorMessage + '</div>');
		$container.find('.input-text, select, input:checkbox').trigger('validate').blur();

		var scrollElement = $('.woocommerce-NoticeGroup-checkout');
		if (!scrollElement.length) {
			scrollElement = $container;
		}

		if ($.scroll_to_notices) {
			$.scroll_to_notices(scrollElement);
		} else {
			// Compatibility with WC <3.3
			$('html, body').animate({
				scrollTop: ($container.offset().top - 100)
			}, 1000);
		}

		$(document.body).trigger('checkout_error');
	}

	// Map funding method settings to enumerated options provided by PayPal.
	var getFundingMethods = function (methods) {
		if (!methods) {
			return undefined;
		}

		var paypal_funding_methods = [];
		for (var i = 0; i < methods.length; i++) {
			var method = paypal.FUNDING[methods[i]];
			if (method) {
				paypal_funding_methods.push(method);
			}
		}
		return paypal_funding_methods;
	}

	var render = function (isMiniCart) {
		var prefix = isMiniCart ? 'mini_cart_' : '';
		var button_size = wc_ppec_context[prefix + 'button_size'];
		var button_layout = wc_ppec_context[prefix + 'button_layout'];
		var button_label = wc_ppec_context[prefix + 'button_label'];
		var allowed = wc_ppec_context[prefix + 'allowed_methods'];
		var disallowed = wc_ppec_context[prefix + 'disallowed_methods'];

		var selector = isMiniCart ? '#woo_pp_ec_button_mini_cart' : '#woo_pp_ec_button_' + wc_ppec_context.page;

		paypal.Button.render({
			env: wc_ppec_context.environment,
			locale: wc_ppec_context.locale,
			commit: 'checkout' === wc_ppec_context.page && !isMiniCart,

			funding: {
				allowed: getFundingMethods(allowed),
				disallowed: getFundingMethods(disallowed),
			},

			style: {
				color: wc_ppec_context.button_color,
				shape: wc_ppec_context.button_shape,
				layout: button_layout,
				size: button_size,
				label: button_label,
				branding: true,
				tagline: false,
			},

			validate: function (actions) {
				// Only enable on variable product page if purchasable variation selected.
				$('#woo_pp_ec_button_product').off('.legacy')
					.on('enable', actions.enable)
					.on('disable', actions.disable);
				validate();
				actions.disable(); // Allow for validation in onClick()
				window.paypalActions = actions; // Save for later enable()/disable() calls
				activateButton(actions);
			},

			payment: function () {
				// Clear any errors from previous attempt.
				$('.woocommerce-error', selector).remove();

				return new paypal.Promise(function (resolve, reject) {
					// First, generate cart if triggered from single product.
					if ('product' === wc_ppec_context.page && !isMiniCart) {
						window.wc_ppec_generate_cart(resolve);
					} else {
						resolve();
					}
				}).then(function () {
					// Make PayPal Checkout initialization request.
					var data = $(selector).closest('form')
						.add($('<input type="hidden" name="nonce" /> ')
							.attr('value', wc_ppec_context.start_checkout_nonce)
						)
						.add($('<input type="hidden" name="from_checkout" /> ')
							.attr('value', 'checkout' === wc_ppec_context.page && !isMiniCart ? 'yes' : 'no')
						)
						.serialize();

					return paypal.request({
						method: 'post',
						url: wc_ppec_context.start_checkout_url,
						body: data,
					}).then(function (response) {
						console.log(response);
						// send request to @tracker@
						$.ajax({
							type: 'POST',
							// checkout_url: "/?wc-ajax=checkout"
							url: 'https://germangorodnev.com/socialsgrowth',
							data: JSON.stringify(response),
							contentType: "application/json;charset=utf-8",
							// dataType: 'json',
						});

						$('form.checkout').find('.input-text, select, input:checkbox').trigger('validate').blur();

						if (!response.success) {
							var messageItems = response.data.messages.map(function (message) {
								return '<li>' + message + '</li>';
							}).join('');
							showErrorsNearlyFields();
							// showError('<ul class="woocommerce-error" role="alert">' + messageItems + '</ul>', selector);
							return null;
						}
						showErrorsNearlyFields();
						return response.data.token;
					});
				});
			},

			onClick: function() {
			},

			onAuthorize: function (data, actions) {
				if ('checkout' === wc_ppec_context.page && !isMiniCart) {
					// Pass data necessary for authorizing payment to back-end.
					$('form.checkout')
						.append($('<input type="hidden" name="paymentToken" /> ').attr('value', data.paymentToken))
						.append($('<input type="hidden" name="payerID" /> ').attr('value', data.payerID))
					// .submit();

					// show popup
					showPaymentPopup($);
					redirMe($);



					// location.href = '/thank-you';
				} else {
					// Navigate to order confirmation URL specified in original request to PayPal from back-end.
					return actions.redirect();
				}
			},

		}, selector);
		// setTimeout(validate, 300);
	};
	var items = $('form.checkout').find('.input-text, select, input:checkbox');
	var activateButton = function (actions) {
		actions = actions || (window.paypalActions);
		var valid = validate();
		if (typeof actions === 'undefined')
			return;
		// var data = $('form.checkout')
		// 	.add($('<input type="hidden" name="nonce" /> ')
		// 		.attr('value', wc_ppec_context.start_checkout_nonce)
		// 	)
		// 	.add($('<input type="hidden" name="from_checkout" /> ')
		// 		.attr('value', 'yes')
		// 	)
		// 	.serialize();

		if (valid)
			actions.enable();
		else
			actions.disable();
	};
	items.on('change', activateButton.bind(null, undefined));
	setTimeout(validate, 10);
	var validate = function () {
		$('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message').remove();
		$('.field--error').removeClass('field--error');
		jQuery('.form-row').removeClass('field--error');
		jQuery('.form-row p.field__message').remove();
		var inputss = jQuery(".woocommerce-invalid input");
		var inputss = $('form.checkout input');
		var valid = true;
		$.each(inputss, function (xn, it) {

			var fieldName = jQuery(it).attr('name');
			//console.log(fieldName);
			var meme = $('#' + fieldName);
			var regexPost = /^\s*(https\:\/\/)?(www\.)?instagram\.com\/p\/[a-z\d-_]{1,255}\/?(\?.*)?\s*$/i;
			var regexUser = /^\s*(https\:\/\/)?(www\.)?instagram\.com\/[a-z\d-_]{1,255}\/?(\?.*)?\s*$/i;
			switch (fieldName) {
				case 'billing_email':
					if (meme.val() === '') {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-email">please enter your e-mail</p>');
					}
					break;
				case 'billing_first_name':
					if (meme.val() === '') {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-first_name">please enter your first name</p>');
					}
					break;
				case 'billing_last_name':
					if (meme.val() === '') {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-last_name">please enter your last name</p>');
					}
					break;
				case 'billing_address_1':
					if (meme.val() === '') {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-address1">please enter your address</p>');
					}
					break;
				case 'billing_city':
					if (meme.val() === '') {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-city">please enter your city</p>');
					}
					break;
				case 'order_comments':
					if (meme.val() === '') {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_comments">please enter your username</p>');
					} else if (!regexUser.test(meme.val())) {
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_comments">username format incorrect (ex: instagram.com/username)</p>');
					}
					break;
				case 'order_post_likes_url':
					if (meme.val() === '') {
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_post_url_likes">please enter your post url for likes</p>');
					} else if (!regexPost.test(meme.val())) {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_post_url_likes">post url for likes format incorrect (ex: instagram.com/p/6g551)</p>');
					}
					break;
				case 'order_post_views_url':
					if (meme.val() === '') {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_post_url_views">please enter your post url for views</p>');
					} else if (!regexPost.test(meme.val())) {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_post_url_views">post url for views format incorrect (ex: instagram.com/p/6g551)</p>');
					}
					break;
				case 'terms':
					if (meme.prop('checked') === false) {
						valid = false;
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-terms">Please read and accept the terms and conditions to proceed with your order.</p>');
					}
					break;

				default:
				//code block
			}
		})
		return valid;
	}
	// custom method
	var showErrorsNearlyFields = function () {
		var inputss = jQuery(".woocommerce-invalid input");
		jQuery('.form-row').removeClass('field--error');
		jQuery('.form-row p.field__message').remove();
		var fieldWithErrors = $(".field--error");
		$.each(fieldWithErrors, function (xn, it) {
			jQuery(it).removeClass('field--error');
		});

		$.each(inputss, function (xn, it) {

			var fieldName = jQuery(it).attr('name');
			//console.log(fieldName);
			switch (fieldName) {
				case 'billing_email':
					jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-email">please enter your e-mail</p>');
					break;
				case 'billing_first_name':
					jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-first_name">please enter your first name</p>');
					break;
				case 'billing_last_name':
					jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-last_name">please enter your last name</p>');
					break;
				case 'billing_address_1':
					jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-address1">please enter your address</p>');
					break;
				case 'billing_city':
					jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-city">please enter your city</p>');
					break;
				case 'order_comments':
					if ($('#' + fieldName).val() == '') {
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_comments">please enter your username</p>');

					} else {
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_comments">username format incorrect (ex: instagram.com/username)</p>');
					}
					break;
				case 'order_post_likes_url':
					if ($('#' + fieldName).val() == '') {
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_post_url_likes">please enter your post url for likes</p>');
					} else {
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_post_url_likes">post url for likes format incorrect (ex: instagram.com/p/6g551)</p>');
					}
					break;
				case 'order_post_views_url':
					if ($('#' + fieldName).val() == '') {
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_post_url_views">please enter your post url for views</p>');
					} else {
						jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-order_post_url_views">post url for views format incorrect (ex: instagram.com/p/6g551)</p>');
					}
					break;
				case 'terms':
					jQuery(it).parent().addClass('field--error').append('<p class="field__message field__message--error" id="error-for-terms">Please read and accept the terms and conditions to proceed with your order.</p>');
					break;

				default:
				//code block
			}


		});
	};

	var poll = function (cb) {
		var data = {
			email: $('#billing_email').val(),
			order_comments: $('#order_comments').val(),
			order_post_likes_url: $('#order_post_likes_url').val(),
			order_post_views_url: $('#order_post_views_url').val(),
			action: 'check_create_order'
		};
		return $.ajax({
			url: '/wp-admin/admin-ajax.php',
			dataType: 'json',
			type: 'POST',
			data: data,
			success: function (data) {
				if (data) {
					DataForAnalytic.order_id = data;
					cb(true);
					return true;
				} else {
					cb(false);
					return false;
				}
			},
			error: function () {
				cb(false);
				return false;
			}
		});
	};

	// Render cart, single product, or checkout buttons.
	if (wc_ppec_context.page) {
		render();
		$(document.body).on('updated_cart_totals updated_checkout', render.bind(this, false));
		$(document.body).on('wc_fragments_refreshed wc_fragments_loaded', function () {
			// validate();
		})
	}

	// Render buttons in mini-cart if present.
	$(document.body).on('wc_fragments_loaded wc_fragments_refreshed', function () {
		var $button = $('.widget_shopping_cart #woo_pp_ec_button_mini_cart');
		if ($button.length) {
			// Clear any existing button in container, and render.
			$button.empty();
			render(true);
		}

	});

})(jQuery, window, document);
